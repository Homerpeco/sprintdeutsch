#!/usr/bin/env python3
"""
sandbox_rebuild.py
------------------
Runs the library rebuild from Claude's Linux sandbox instead of your Mac, so a
scheduled task can chip away at it unattended.

Two constraints shape this file, both specific to the sandbox:

1. ChromaDB cannot open its SQLite file on the mounted macOS folder — it fails
   with "disk I/O error" because the mount doesn't support the locking SQLite
   wants. So the store is copied to local disk, worked on there, and copied back.

2. Every shell command is killed after ~45s and background processes do not
   survive between calls. So this runs in short slices: do as much as fits in
   BUDGET seconds, sync, exit, get called again.

Resume is derived from the database itself — a chunk's ID is a stable hash of
(source, index, text), so "what's left" is just "which IDs aren't in the
collection yet". There is no progress file to drift out of sync with reality if
the same rebuild is also run by hand on the Mac.

Exit codes:
    0  corpus fully embedded, nothing left to do
    2  budget for this slice used up — call again
    3  Gemini daily quota exhausted — stop until it resets
    1  real error
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

# Derived from this file's own location: the sandbox mount path contains a
# session id that changes every session, so hard-coding it breaks on the next run.
MOUNT = Path(os.environ.get("SD_BACKEND", "")) if os.environ.get("SD_BACKEND") else Path(__file__).resolve().parent
# /tmp can hold a work dir left by an earlier sandbox session under a different
# uid, which is unreadable to us; keep the path per-user so that can't collide.
WORK = Path(os.environ.get("SD_WORK") or f"/tmp/sd-{os.getuid()}")
LOCAL_DB = WORK / "chroma_db"
BUDGET = float(os.environ.get("BUDGET", "34"))
# How many chunks to embed before writing to the collection. The write is the
# commit point: if the slice is killed mid-window, the API calls already made for
# that window are lost *and so is the daily quota they consumed*. Books with very
# large chunks embed only ~5 at a time (the request is character-capped), so a
# 25-chunk window can take minutes and is easy to lose. Keep it small.
UPSERT_BATCH = int(os.environ.get("UPSERT_BATCH", "5"))

os.environ["CHROMA_DIR"] = str(LOCAL_DB)
sys.path.insert(0, str(MOUNT))

from dotenv import load_dotenv  # noqa: E402
load_dotenv(MOUNT / ".env")

import rag  # noqa: E402


def log(m: str = "") -> None:
    print(m, flush=True)


# Rollback journals / WAL sidecars must never travel with the database. They are
# only meaningful next to the exact file they were written for; a stale journal
# copied alongside a newer main file makes SQLite "roll back" pages that were
# never part of that transaction, which silently corrupts the store. This is not
# hypothetical — it destroyed the Aug 5 store and cost a day of embeddings.
SIDECARS = ("-journal", "-wal", "-shm")


def _is_sidecar(name: str) -> bool:
    return any(name.endswith(s) for s in SIDECARS)


def pull() -> None:
    """Mirror the committed store onto local disk (once per sandbox session)."""
    if LOCAL_DB.exists():
        return
    WORK.mkdir(parents=True, exist_ok=True)
    src = MOUNT / "chroma_db"
    if src.exists():
        shutil.copytree(src, LOCAL_DB,
                        ignore=lambda d, names: [n for n in names if _is_sidecar(n)])
        log(f"pulled {sum(f.stat().st_size for f in LOCAL_DB.rglob('*') if f.is_file()) / 1e6:.0f}MB from the repo")
    else:
        LOCAL_DB.mkdir(parents=True)


def push() -> None:
    """Replace the repo copy of the store with the worked-on one.

    Plain file writes work on the mount even though SQLite's locking doesn't, so
    this is a copy rather than pointing Chroma at the mount directly.

    It is a *mirror*, not a merge: anything in the repo folder that is not part
    of the local store is deleted afterwards. Merging is what previously left
    orphaned segment directories and a stale rollback journal behind, and the
    store Chroma opens must contain nothing but the files of the current
    database. The prune runs only after a complete copy, so an interrupted sync
    leaves a superset of the store rather than a truncated one.

    Note the copy-then-prune shape: staging the store in a sibling directory and
    renaming it into place would be tidier, but the macOS mount refuses to
    rename a non-empty directory (OSError 39).
    """
    dest = MOUNT / "chroma_db"
    dest.mkdir(parents=True, exist_ok=True)
    subprocess.run(["cp", "-a", f"{LOCAL_DB}/.", str(dest)], check=True)
    keep = {p.relative_to(LOCAL_DB) for p in LOCAL_DB.rglob("*")}
    for p in sorted(dest.rglob("*"), key=lambda q: len(q.parts), reverse=True):
        rel = p.relative_to(dest)
        if rel in keep and not _is_sidecar(p.name):
            continue
        if p.is_dir():
            shutil.rmtree(p, ignore_errors=True)
        else:
            p.unlink(missing_ok=True)


def pending(col) -> list:
    """Chunks not yet embedded, in stable book order."""
    have = set(col.get(include=[])["ids"])
    todo = []
    for pdf in rag.iter_pdfs(rag.PDF_FOLDER):
        chunks = rag.chunk_pages(rag.extract_pdf_text_by_page(pdf), source=pdf.name)
        missing = [c for c in chunks if c.chunk_id() not in have]
        if missing:
            todo.append((pdf.name, len(chunks), missing))
    return todo


def main() -> int:
    t0 = time.time()
    pull()
    col = rag.get_collection()

    todo = pending(col)
    remaining = sum(len(m) for _, _, m in todo)
    if remaining == 0:
        # Mirror into the collection the server actually queries, reusing the
        # vectors we already paid for rather than embedding a second time.
        gcol = rag.get_chroma().get_or_create_collection(
            name=rag.GEMINI_COLLECTION, metadata={"hnsw:space": "cosine"})
        if gcol.count() < col.count():
            d = col.get(include=["documents", "metadatas", "embeddings"])
            for i in range(0, len(d["ids"]), 200):
                gcol.upsert(ids=d["ids"][i:i + 200], documents=d["documents"][i:i + 200],
                            metadatas=d["metadatas"][i:i + 200],
                            embeddings=[list(v) for v in d["embeddings"][i:i + 200]])
            push()
        log(f"COMPLETE — {col.count()} chunks, {gcol.count()} queryable.")
        return 0

    log(f"{remaining} chunks left across {len(todo)} book(s)")

    embedded = 0
    for name, total, missing in todo:
        done_here = total - len(missing)
        log(f"  {name[:52]} — {done_here}/{total}")
        for i in range(0, len(missing), UPSERT_BATCH):
            if time.time() - t0 > BUDGET:
                push()
                log(f"SLICE — embedded {embedded} this run, {remaining - embedded} left.")
                return 2
            window = missing[i:i + UPSERT_BATCH]
            try:
                vecs = rag.embed_texts([c.text for c in window])
            except rag.QuotaExhausted:
                push()
                log(f"QUOTA — embedded {embedded} this run, {remaining - embedded} left. "
                    f"Resets at midnight US Pacific.")
                return 3
            col.upsert(
                ids=[c.chunk_id() for c in window],
                documents=[c.text for c in window],
                metadatas=[{"source": c.source, "page_start": c.page_start,
                            "page_end": c.page_end, "chunk_index": c.chunk_index} for c in window],
                embeddings=vecs,
            )
            embedded += len(window)
            log(f"    +{len(window)}  ({embedded} this run, {time.time() - t0:.0f}s)")

    push()
    log(f"SLICE — embedded {embedded} this run; ingest finished, run again to mirror.")
    return 2


if __name__ == "__main__":
    sys.exit(main())
