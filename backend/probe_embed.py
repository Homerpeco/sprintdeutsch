"""
probe_embed.py
--------------
Diagnostic: work out exactly why embedding calls return 429.

Makes ONE tiny embedding request against each candidate model and prints the
full error payload, including the quota metric and limit that Google reports.
A single call costs ~5 tokens, so this is safe to run even when quota is tight.

Usage:
    cd backend
    source .venv/bin/activate
    python probe_embed.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

import os

CANDIDATES = [
    ("gemini-embedding-001", 768),   # what rag.py uses today
    ("gemini-embedding-2", 768),     # newer multimodal, free tier per pricing page
    ("text-embedding-004", None),    # older generation, historically generous free tier
]


def main() -> int:
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        print("✗ GEMINI_API_KEY not set")
        return 1
    print(f"key ...{key[-6:]}  (len {len(key)})\n")

    from google import genai
    from google.genai import types
    client = genai.Client(api_key=key)

    # Which embedding models does this key actually list?
    print("── models advertising embedContent ──")
    try:
        for m in client.models.list():
            actions = getattr(m, "supported_actions", None) or []
            if "embedContent" in actions:
                print(f"  {m.name}")
    except Exception as e:  # noqa: BLE001
        print(f"  (could not list models: {e})")
    print()

    print("── single-call probe ──")
    ok_models = []
    for model, dims in CANDIDATES:
        cfg = {"task_type": "RETRIEVAL_QUERY"}
        if dims:
            cfg["output_dimensionality"] = dims
        try:
            resp = client.models.embed_content(
                model=model,
                contents=["Hallo Welt"],
                config=types.EmbedContentConfig(**cfg),
            )
            n = len(resp.embeddings[0].values)
            print(f"  ✓ {model}: OK ({n} dims)")
            ok_models.append(model)
        except Exception as e:  # noqa: BLE001
            detail = str(e).replace("\n", " ")
            print(f"  ✗ {model}: {detail[:600]}")

    print()
    if ok_models:
        print(f"→ Usable model(s): {', '.join(ok_models)}")
        print(f"  Set EMBEDDING model in backend/.env:  GEMINI_EMBEDDING_MODEL={ok_models[0]}")
    else:
        print("→ No embedding model is reachable on this key/project.")
        print("  The quota block is account-level, not model-specific.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
