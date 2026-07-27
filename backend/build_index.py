"""
build_index.py
--------------
Build the Gemini-embedded ChromaDB collection ON YOUR MACHINE, so the deployed
server never has to.

Why this exists
---------------
Render's free instance has 512MB RAM — too small for a local transformer, and
building the index at server startup burned through the free Gemini embedding
quota (429 RESOURCE_EXHAUSTED), which left retrieval stuck on the BM25 keyword
fallback. Building here once and committing `chroma_db/` means:

  * the server loads a finished index — no startup build, no 429, no OOM
  * each learner question costs exactly one small RETRIEVAL_QUERY embedding,
    which fits comfortably inside the free tier

Usage
-----
    cd backend
    source .venv/bin/activate
    python build_index.py            # resumable — safe to re-run after a 429

Then commit `backend/chroma_db/` and push.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

# rag.py deliberately does not read .env (on Render the vars come from the
# dashboard). This script runs standalone on your machine, so load it here —
# before importing rag, which snapshots config into module-level constants.
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

import rag  # noqa: E402


BATCH = 50          # texts per embed call
PAUSE = 4.0         # seconds between batches — stays under free-tier rate limits
MAX_RETRIES = 6


def log(msg: str) -> None:
    print(msg, flush=True)


def main() -> int:
    if not rag.env("GEMINI_API_KEY"):
        log("✗ GEMINI_API_KEY not set. Put it in backend/.env and re-run.")
        return 1

    src = rag.get_collection()
    total = src.count()
    if total == 0:
        log("✗ Source collection is empty — run `python ingest.py` first.")
        return 1

    client = rag.get_chroma()
    gcol = client.get_or_create_collection(
        name=rag.GEMINI_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )

    data = src.get(include=["documents", "metadatas"])
    ids, docs, metas = data["ids"], data["documents"], data["metadatas"]

    # Resume support: skip anything already embedded, so a quota error partway
    # through costs you only the remaining chunks on the next run.
    done: set[str] = set()
    existing = gcol.count()
    if existing:
        got = gcol.get(include=[])
        done = set(got["ids"])
        log(f"→ resuming: {len(done)}/{total} chunks already embedded")

    todo = [(i, d, m) for i, d, m in zip(ids, docs, metas) if i not in done]
    if not todo:
        log(f"✓ Index already complete ({total} chunks). Nothing to do.")
        return 0

    log(f"→ embedding {len(todo)} chunks with {rag.GEMINI_EMBED_MODEL} "
        f"({rag.GEMINI_EMBED_DIMS} dims), {BATCH} per call")

    for start in range(0, len(todo), BATCH):
        window = todo[start:start + BATCH]
        w_ids = [x[0] for x in window]
        w_docs = [x[1] for x in window]
        w_metas = [x[2] for x in window]

        for attempt in range(MAX_RETRIES):
            try:
                vecs = rag._gemini_embed(w_docs, "RETRIEVAL_DOCUMENT")
                break
            except Exception as e:  # noqa: BLE001
                msg = str(e)
                transient = "429" in msg or "RESOURCE_EXHAUSTED" in msg or "503" in msg
                if transient and attempt < MAX_RETRIES - 1:
                    wait = 30 * (attempt + 1)
                    log(f"  ! rate limited, waiting {wait}s (attempt {attempt + 1}/{MAX_RETRIES})")
                    time.sleep(wait)
                    continue
                log(f"✗ Failed at chunk {start + len(done)}: {e}")
                log("  Progress is saved — re-run this script to resume "
                    "(free-tier quota resets daily).")
                return 1

        gcol.upsert(ids=w_ids, documents=w_docs, metadatas=w_metas, embeddings=vecs)
        finished = len(done) + start + len(window)
        log(f"  {finished}/{total} chunks  ({finished * 100 // total}%)")
        time.sleep(PAUSE)

    log(f"✓ Done — {gcol.count()}/{total} chunks embedded into '{rag.GEMINI_COLLECTION}'.")
    log("  Now commit backend/chroma_db/ and push; the server will load it as-is.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
