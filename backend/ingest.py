#!/usr/bin/env python3
"""
ingest.py
---------
Ingest PDFs from your library into the local ChromaDB vector store.

Usage:
    python ingest.py                       # ingest from $PDF_FOLDER, skip already-done
    python ingest.py --folder /path/to/pdfs
    python ingest.py --force               # re-ingest everything
    python ingest.py --only "Hammer*.pdf"  # glob filter
    python ingest.py --stats               # print library stats, do nothing else
    python ingest.py --reset               # drop the whole collection (asks first)

The script is idempotent. PDFs already present (by filename) are skipped
unless --force is used.
"""

from __future__ import annotations

import argparse
import fnmatch
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

# Load .env BEFORE importing rag — rag reads from env at import time.
load_dotenv(Path(__file__).resolve().parent / ".env")

import rag  # noqa: E402


def parse_args():
    ap = argparse.ArgumentParser(description="Ingest PDFs into Langey's vector library.")
    ap.add_argument("--folder", help="Override PDF folder (defaults to $PDF_FOLDER).")
    ap.add_argument("--force", action="store_true", help="Re-ingest PDFs that are already in the store.")
    ap.add_argument("--only", help="Only ingest PDFs matching this glob (e.g. 'Hammer*.pdf').")
    ap.add_argument("--stats", action="store_true", help="Print library stats and exit.")
    ap.add_argument("--reset", action="store_true", help="Delete the whole collection (asks for confirmation).")
    ap.add_argument("--limit", type=int, help="Ingest at most this many PDFs (handy for smoke tests).")
    return ap.parse_args()


def fmt_secs(s: float) -> str:
    if s < 60: return f"{s:.1f}s"
    m, s = divmod(s, 60)
    return f"{int(m)}m{int(s)}s"


def main():
    args = parse_args()

    if args.stats:
        stats = rag.collection_stats()
        print(f"Library: {stats['chunks']} chunks across {stats['source_count']} PDFs")
        for s in stats["sources"]:
            print(f"  - {s}")
        return

    if args.reset:
        confirm = input("Drop the entire vector collection? Type 'yes' to confirm: ").strip().lower()
        if confirm != "yes":
            print("Aborted."); return
        client = rag.get_chroma()
        try:
            client.delete_collection(rag.COLLECTION_NAME)
            print(f"Collection {rag.COLLECTION_NAME!r} dropped.")
        except Exception as e:
            print(f"Nothing to drop (or failed): {e}")
        return

    folder = Path(args.folder).resolve() if args.folder else rag.PDF_FOLDER
    if not folder.exists():
        print(f"PDF folder not found: {folder}")
        print(f"Create it or set PDF_FOLDER in your .env, then rerun.")
        sys.exit(1)

    pdfs = list(rag.iter_pdfs(folder))
    if args.only:
        pdfs = [p for p in pdfs if fnmatch.fnmatch(p.name, args.only)]
    if not pdfs:
        print(f"No PDFs matched in {folder}.")
        return

    already = set() if args.force else rag.already_ingested_sources()
    todo = [p for p in pdfs if p.name not in already]
    skipped = len(pdfs) - len(todo)

    if args.limit:
        todo = todo[: args.limit]

    print(f"Folder:   {folder}")
    print(f"Found:    {len(pdfs)} PDFs ({skipped} already ingested, skipping)")
    print(f"To do:    {len(todo)} PDFs")
    if not todo:
        print("Nothing to ingest. Use --force to re-ingest.")
        return

    # Eagerly load the embedding model so its first-time download/init isn't
    # silently bundled into the first PDF timing.
    print(f"Loading embedding model ({rag.EMBEDDING_MODEL}) … ", end="", flush=True)
    t0 = time.time()
    rag.get_embedder()
    print(f"done in {fmt_secs(time.time() - t0)}")

    total_chunks = 0
    total_pages = 0
    started = time.time()

    for i, pdf in enumerate(todo, 1):
        t_pdf = time.time()
        try:
            pages = rag.extract_pdf_text_by_page(pdf)
        except Exception as e:
            print(f"  [{i}/{len(todo)}] {pdf.name}  ✗ extract failed: {e}")
            continue

        chunks = rag.chunk_pages(pages, source=pdf.name)
        if not chunks:
            print(f"  [{i}/{len(todo)}] {pdf.name}  ⚠ no chunks (scan-only / image-based PDF?)")
            continue

        try:
            added = rag.add_chunks(chunks)
        except Exception as e:
            print(f"  [{i}/{len(todo)}] {pdf.name}  ✗ embed/store failed: {e}")
            continue

        total_chunks += added
        total_pages += len(pages)
        dt = time.time() - t_pdf
        print(f"  [{i}/{len(todo)}] {pdf.name}  ✓ {len(pages)}p → {added} chunks  ({fmt_secs(dt)})")

    print("")
    print(f"Done. {total_chunks} chunks from {total_pages} pages in {fmt_secs(time.time() - started)}.")
    stats = rag.collection_stats()
    print(f"Library now: {stats['chunks']} chunks across {stats['source_count']} PDFs.")


if __name__ == "__main__":
    main()
