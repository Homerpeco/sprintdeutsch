# SprintDeutsch backend

A small Python service that powers the AI tutor in the SprintDeutsch prototype.

Three moving parts:

1. **`ingest.py`** — reads every PDF in your library, chunks it
   paragraph-by-paragraph, embeds the chunks with a multilingual
   sentence-transformer, and stores them locally in ChromaDB.
2. **`rag.py`** — shared retrieval and LLM logic. Provider-agnostic:
   you can swap Gemini for Claude with one env variable.
3. **`app.py`** — a FastAPI server exposing `/chat`, `/search`,
   `/library/stats`, `/health`. The React frontend calls `/chat`.

## One-time setup

```bash
cd backend

# Python 3.10+ recommended. Optional but tidy:
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env: paste your Google AI Studio key (free tier) or your Anthropic key.
```

The first time you ingest, sentence-transformers will download the embedding
model (~120 MB by default). After that, it loads from disk in seconds.

## Ingest your PDFs

Point `PDF_FOLDER` in `.env` at the folder you want to index, then:

```bash
python ingest.py                  # ingest everything (skips already-done PDFs)
python ingest.py --limit 3        # smoke test with the first 3 PDFs
python ingest.py --only "Hammer*" # ingest only matching filenames
python ingest.py --stats          # show what's in the library
python ingest.py --reset          # nuke the collection (asks first)
```

Ingest is idempotent. Re-running it skips PDFs that have already been
processed unless you pass `--force`.

For a 600-page grammar book, expect ~30-60 seconds on a recent laptop.
The bottleneck is sentence-transformers embedding, not the PDF parsing.

## Run the server

```bash
uvicorn app:app --reload --port 8000
```

Open the React app (`../index.html`) in a browser. The AI Tutor panel
will hit `http://localhost:8000/chat` automatically. Replies include
citations to the specific PDF and page range each answer is grounded in.

## Switching LLM providers

In `.env`:

```ini
LLM_PROVIDER=gemini     # or "claude"
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
```

You can also override per-request from the frontend (a toggle in the
chat panel) — handy for A/B testing the same prompt on both models.

## File layout

```
backend/
  app.py              FastAPI server
  ingest.py           PDF ingestion CLI
  rag.py              Chunking, embeddings, retrieval, LLM clients
  requirements.txt
  .env.example
  .env                (you create this — gitignored)
  chroma_db/          (auto-created — your vector store)
```

## API

### `GET /health`

```json
{
  "ok": true,
  "default_provider": "gemini",
  "providers_configured": { "gemini": true, "claude": false },
  "embedding_model": "paraphrase-multilingual-MiniLM-L12-v2"
}
```

### `GET /library/stats`

```json
{ "chunks": 4218, "source_count": 22, "sources": ["73 Deutsch intensiv Grammatik B1.pdf", ...] }
```

### `POST /search`

```json
{ "query": "Konjunktiv II Vergangenheit", "k": 5 }
```

Returns the top-k chunks with citations, no LLM call. Useful for
debugging "is my retrieval working at all?".

### `POST /chat`

```json
{
  "messages": [
    {"role": "user", "content": "Erkläre mir den Genitiv mit zwei Beispielen."}
  ],
  "level": "B2",
  "provider": "gemini",
  "use_rag": true
}
```

Returns:

```json
{
  "reply": "Der Genitiv …",
  "provider": "gemini",
  "rag_used": true,
  "sources": [
    {
      "source": "63 A-Grammatik … A1-A2 2023.pdf",
      "page_start": 142, "page_end": 143,
      "score": 0.78,
      "citation": "63 A-Grammatik … A1-A2 2023.pdf, pp.142-143",
      "preview": "Der Genitiv drückt Zugehörigkeit aus …"
    }
  ]
}
```

## When you're ready to harden

- Move the LLM key out of `.env` and into a secret manager.
- Put the server behind HTTPS (e.g. deploy to Fly.io / Railway / Render).
- Swap the in-process ChromaDB for a managed vector DB if you outgrow
  local files (Qdrant Cloud, Pinecone).
- Add streaming responses (`/chat/stream`) for a snappier UI.
- Replace the default embedding model with `BAAI/bge-m3` for better
  German recall at the cost of ~2 GB on disk.

Hand all of this to Claude Code with that list and it can take you the
rest of the way.
