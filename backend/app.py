"""
app.py
------
FastAPI server. Exposes:

  GET  /health                   → ok + provider info
  GET  /library/stats            → number of chunks / list of ingested PDFs
  POST /search   { query, k? }   → top-k chunks for a query (no LLM call)
  POST /chat     { messages, level, provider?, use_rag? }
                                 → tutor reply + citations
  POST /chat/stream              → SSE streaming version of /chat

Run:
    cd backend
    cp .env.example .env       # add your API key
    pip install -r requirements.txt
    uvicorn app:app --reload --port 8000

Then open ../index.html in your browser; the AI Tutor panel will use this backend.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import rag  # noqa: E402


app = FastAPI(title="SprintDeutsch backend", version="0.1.0")

# CORS — the React app may run from file:// (origin "null") or a local dev
# server. For a personal app, fully open is fine.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----- request / response models -----

class Message(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    level: str = "B1"
    provider: Optional[str] = None    # "gemini" or "claude"; defaults to env
    use_rag: bool = True
    rag_query: Optional[str] = None   # explicit retrieval query; overrides last user message


class SearchRequest(BaseModel):
    query: str
    k: int = rag.TOP_K


# ----- endpoints -----

@app.get("/health")
def health():
    provider = os.environ.get("LLM_PROVIDER", "gemini")
    has_gemini = bool(os.environ.get("GEMINI_API_KEY"))
    has_claude = bool(os.environ.get("ANTHROPIC_API_KEY"))
    return {
        "ok": True,
        "default_provider": provider,
        "providers_configured": {
            "gemini": has_gemini,
            "claude": has_claude,
        },
        "embedding_model": rag.EMBEDDING_MODEL,
        "chroma_dir": str(rag.CHROMA_DIR),
    }


@app.get("/library/stats")
def library_stats():
    return rag.collection_stats()


@app.post("/search")
def search(req: SearchRequest):
    if not req.query.strip():
        raise HTTPException(400, "Empty query")
    hits = rag.retrieve(req.query, k=req.k)
    return {
        "query": req.query,
        "count": len(hits),
        "hits": [{
            "source": h.source,
            "page_start": h.page_start,
            "page_end": h.page_end,
            "score": round(h.score, 3),
            "citation": h.citation(),
            "text": h.text,
        } for h in hits],
    }


@app.post("/chat")
def chat(req: ChatRequest):
    if not req.messages:
        raise HTTPException(400, "messages is empty")
    # Last message is the new user turn; the rest is history.
    if req.messages[-1].role != "user":
        raise HTTPException(400, "last message must be from the user")

    user_msg = req.messages[-1].content
    history = [m.model_dump() for m in req.messages[:-1]]

    try:
        result = rag.chat_with_rag(
            user_message=user_msg,
            history=history,
            level=req.level,
            provider=req.provider,
            use_rag=req.use_rag,
            rag_query=req.rag_query,
        )
    except rag.LLMError as e:
        raise HTTPException(502, f"LLM error: {e}")
    except Exception as e:
        raise HTTPException(500, f"Unexpected error: {e}")

    return result

@app.post("/chat/stream")
def chat_stream(req: ChatRequest):
    if not req.messages:
        raise HTTPException(400, "messages is empty")
    if req.messages[-1].role != "user":
        raise HTTPException(400, "last message must be from the user")

    user_msg = req.messages[-1].content
    history = [m.model_dump() for m in req.messages[:-1]]

    return StreamingResponse(
        rag.chat_with_rag_stream(
            user_message=user_msg,
            history=history,
            level=req.level,
            provider=req.provider,
            use_rag=req.use_rag,
            rag_query=req.rag_query,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable nginx/proxy buffering if you ever deploy behind one
        },
    )