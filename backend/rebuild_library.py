#!/usr/bin/env python3
"""
rebuild_library.py
------------------
One command to rebuild the AI tutor's whole PDF library, end to end:

    cd backend
    source .venv/bin/activate
    python rebuild_library.py

What it does
------------
1. Drops the old vector collections if they were built at the wrong dimension
   (the original ones are 384-dim, left over from the sentence-transformers era;
   Gemini embeddings are 768-dim and cannot be mixed in).
2. Chunks and embeds every text-bearing PDF in $PDF_FOLDER into `langey_corpus`.
3. Copies those vectors into `langey_corpus_gemini` — the collection the server
   actually queries — without spending a second round of embedding quota.

Why it is slow
--------------
The free Gemini tier caps embedding at roughly 30,000 tokens per minute, so
`rag.embed_texts` paces itself to stay under it. Expect ~1 minute per 90,000
characters of book text — a full 13-book rebuild is around 80 minutes. Leave it
running; it is resumable.

Resumability
------------
Progress is written to `rebuild_state.json` after every batch. If the run is
interrupted — Ctrl-C, laptop sleep, quota reset — just run the same command
again and it picks up mid-book where it stopped.

Image-only PDFs
---------------
Scanned books yield zero extractable text and are reported as skipped. Running
OCR on them (e.g. `ocrmypdf in.pdf out.pdf`) makes them ingestable.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

import rag  # noqa: E402

STATE_PATH = BACKEND_DIR / "rebuild_state.json"
UPSERT_BATCH = 25          # chunks written to Chroma per resumable step


def log(msg: str = "") -> None:
    print(msg, flush=True)


def fmt(secs: float) -> str:
    m, s = divmod(int(secs), 60)
    return f"{m}m{s:02d}s" if m else f"{s}s"


def load_state() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text())
        except json.JSONDecodeError:
            pass
    return {"done": [], "partial": {}, "skipped": []}


def save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=1))


def collection_dim(col) -> int | None:
    """Vector width of an existing collection, or None if it's empty."""
    try:
        if col.count() == 0:
            return None
        sample = col.get(limit=1, include=["embeddings"])["embeddings"]
        if sample is None or len(sample) == 0 or sample[0] is None:
            return None
        return len(sample[0])
    except Exception:  # noqa: BLE001
        return None


def ensure_right_dimension(force: bool) -> None:
    """Drop collections that were built at a different embedding width."""
    client = rag.get_chroma()
    base = rag.get_collection()
    dim = collection_dim(base)
    if dim is None:
        return
    if dim == rag.GEMINI_EMBED_DIMS and not force:
        return
    reason = (f"existing index is {dim}-dim but {rag.GEMINI_EMBED_MODEL} produces "
              f"{rag.GEMINI_EMBED_DIMS}-dim vectors" if dim != rag.GEMINI_EMBED_DIMS
              else "--force requested")
    log(f"! {reason} — rebuilding from scratch.")
    for name in (rag.COLLECTION_NAME, rag.GEMINI_COLLECTION):
        try:
            client.delete_collection(name)
            log(f"  dropped {name}")
        except Exception:  # noqa: BLE001
            pass
    # Old progress refers to chunks that no longer exist — start clean.
    try:
        STATE_PATH.unlink(missing_ok=True)
    except OSError:
        save_state({"done": [], "partial": {}, "skipped": []})


def reconcile_state(state: dict) -> dict:
    """Trust the vector store over the progress file.

    The two can disagree — a dropped collection, a deleted chroma_db, a crash
    between the upsert and the state write. Anything marked done that isn't
    actually in the store gets re-queued, so a stale state file can never leave
    a book silently missing from the library."""
    stored = rag.already_ingested_sources()
    ghosts = [s for s in state["done"] if s not in stored]
    if ghosts:
        log(f"! {len(ghosts)} book(s) marked done but absent from the store — re-queuing.")
        state["done"] = [s for s in state["done"] if s in stored]
        state["partial"] = {k: v for k, v in state["partial"].items() if k in stored}
        save_state(state)
    return state


def ingest_all(state: dict) -> None:
    pdfs = list(rag.iter_pdfs(rag.PDF_FOLDER))
    if not pdfs:
        log(f"✗ No PDFs found in {rag.PDF_FOLDER}")
        sys.exit(1)

    already = rag.already_ingested_sources()
    col = rag.get_collection()
    started = time.time()

    log(f"Folder: {rag.PDF_FOLDER}")
    log(f"{len(pdfs)} PDFs on disk | {len(state['done'])} already finished")
    log("")

    for pdf in pdfs:
        if pdf.name in state["done"] or pdf.name in state["skipped"]:
            continue
        if pdf.name in already and pdf.name not in state["partial"]:
            state["done"].append(pdf.name)
            save_state(state)
            continue

        chunks = rag.chunk_pages(rag.extract_pdf_text_by_page(pdf), source=pdf.name)
        if not chunks:
            log(f"  ⚠ skipped (image-only scan, no extractable text): {pdf.name}")
            state["skipped"].append(pdf.name)
            save_state(state)
            continue

        start = state["partial"].get(pdf.name, 0)
        total_chars = sum(len(c.text) for c in chunks)
        eta = 60.0 * total_chars / max(rag.EMBED_CHARS_PER_MINUTE, 1)
        log(f"  {pdf.name}")
        log(f"    {len(chunks)} chunks, {total_chars:,} chars, ~{fmt(eta)}"
            + (f" (resuming at {start})" if start else ""))

        while start < len(chunks):
            window = chunks[start:start + UPSERT_BATCH]
            try:
                vecs = rag.embed_texts([c.text for c in window])
            except rag.QuotaExhausted:
                remaining = sum(
                    len(rag.chunk_pages(rag.extract_pdf_text_by_page(p), source=p.name))
                    for p in pdfs
                    if p.name not in state["done"] and p.name not in state["skipped"]
                ) - start
                log("")
                log("⏸  Daily embedding quota exhausted (free tier: 1,000 texts/day).")
                log(f"   Saved: everything up to {pdf.name} chunk {start}.")
                log(f"   Still to embed: ~{max(remaining, 0):,} chunks "
                    f"(~{max(remaining, 0) / 1000:.0f} more day(s) at this rate).")
                log("")
                log("   Options:")
                log("     • Re-run this same command after the quota resets (midnight US Pacific).")
                log("     • Or enable billing on the Google Cloud project — the whole")
                log("       corpus is ~1.6M tokens, about $0.25 at current embedding rates,")
                log("       and finishes in one pass.")
                sys.exit(2)
            col.upsert(
                ids=[c.chunk_id() for c in window],
                documents=[c.text for c in window],
                metadatas=[{
                    "source": c.source,
                    "page_start": c.page_start,
                    "page_end": c.page_end,
                    "chunk_index": c.chunk_index,
                } for c in window],
                embeddings=vecs,
            )
            start += len(window)
            state["partial"][pdf.name] = start
            save_state(state)
            log(f"    {start}/{len(chunks)}  [{fmt(time.time() - started)} elapsed]")

        state["done"].append(pdf.name)
        state["partial"].pop(pdf.name, None)
        save_state(state)
        log(f"    ✓ done")

    log("")
    log(f"Ingest complete in {fmt(time.time() - started)}.")


def build_query_collection() -> None:
    """Mirror the base collection into the one the server queries."""
    src = rag.get_collection()
    total = src.count()
    if total == 0:
        log("✗ Nothing ingested — aborting.")
        sys.exit(1)

    gcol = rag.get_chroma().get_or_create_collection(
        name=rag.GEMINI_COLLECTION, metadata={"hnsw:space": "cosine"})

    data = src.get(include=["documents", "metadatas", "embeddings"])
    ids, docs, metas, vecs = data["ids"], data["documents"], data["metadatas"], data["embeddings"]

    log(f"Copying {total} vectors into '{rag.GEMINI_COLLECTION}' (no API calls needed)…")
    for i in range(0, len(ids), 200):
        gcol.upsert(
            ids=ids[i:i + 200],
            documents=docs[i:i + 200],
            metadatas=metas[i:i + 200],
            embeddings=[list(v) for v in vecs[i:i + 200]],
        )
    log(f"✓ {gcol.count()}/{total} chunks queryable.")


def plan() -> int:
    """Read-only preview: what would be indexed, and how long it would take.

    Worth running before committing to an hour-long rebuild — it catches an
    unmounted drive, a book that still needs OCR, or a wrong PDF_FOLDER in
    seconds instead of forty minutes in."""
    pdfs = list(rag.iter_pdfs(rag.PDF_FOLDER))
    if not pdfs:
        log(f"✗ No PDFs found in {rag.PDF_FOLDER}")
        return 1
    log(f"Folder: {rag.PDF_FOLDER}")
    log("")
    log(f"{'chunks':>7} {'chars':>10}  book")
    total_chunks = total_chars = 0
    needs_ocr: list[str] = []
    for pdf in pdfs:
        chunks = rag.chunk_pages(rag.extract_pdf_text_by_page(pdf), source=pdf.name)
        chars = sum(len(c.text) for c in chunks)
        if not chunks:
            needs_ocr.append(pdf.name)
            log(f"{'—':>7} {'—':>10}  {pdf.name}   ← image-only, needs OCR")
            continue
        log(f"{len(chunks):7} {chars:10,}  {pdf.name}")
        total_chunks += len(chunks)
        total_chars += chars
    log("")
    log(f"{len(pdfs) - len(needs_ocr)} indexable books | {total_chunks:,} chunks | {total_chars:,} chars")
    log(f"Estimated embedding time: {fmt(60.0 * total_chars / max(rag.EMBED_CHARS_PER_MINUTE, 1))}")
    if needs_ocr:
        log(f"{len(needs_ocr)} book(s) would be skipped until OCR'd.")
    log("")
    log("Nothing was written. Re-run without --plan to build.")
    return 0


def main() -> int:
    force = "--force" in sys.argv

    if "--plan" in sys.argv:
        return plan()

    if not rag.env("GEMINI_API_KEY"):
        log("✗ GEMINI_API_KEY not set. Put it in backend/.env and re-run.")
        return 1

    log(f"Embeddings: {rag.GEMINI_EMBED_MODEL} @ {rag.GEMINI_EMBED_DIMS} dims")
    log(f"Rate limit: {rag.EMBED_CHARS_PER_MINUTE:,} chars/min "
        f"(free-tier safe; raise EMBED_CHARS_PER_MINUTE if you enable billing)")
    log("")

    ensure_right_dimension(force)
    state = reconcile_state(load_state())
    ingest_all(state)
    build_query_collection()

    stats = rag.collection_stats()
    log("")
    log(f"Library: {stats['chunks']} chunks across {stats['source_count']} books")
    for s in stats["sources"]:
        log(f"  - {s}")
    if state["skipped"]:
        log("")
        log(f"{len(state['skipped'])} image-only PDFs were skipped (need OCR):")
        for s in state["skipped"]:
            log(f"  - {s}")
    log("")
    log("Next: commit backend/chroma_db/ and push. Render will serve it as-is.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
