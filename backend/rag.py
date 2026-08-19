"""
rag.py
------
Shared retrieval + LLM logic for the SprintDeutsch backend.

Three pieces:
  1. PDF parsing & chunking (paragraph-aware, page-tagged)
  2. ChromaDB-backed vector store with sentence-transformers embeddings
  3. Provider-agnostic LLM interface (Gemini and Claude)
"""

from __future__ import annotations

import os
import re
import json
import hashlib
import itertools
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Optional

import fitz  # PyMuPDF
import chromadb
from chromadb.config import Settings

# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parent

def env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)

def resolve_path(p: str) -> Path:
    path = Path(p)
    return path if path.is_absolute() else (BACKEND_DIR / path).resolve()

CHROMA_DIR        = resolve_path(env("CHROMA_DIR", "./chroma_db"))
PDF_FOLDER        = resolve_path(env("PDF_FOLDER", "../pdfs"))
EMBEDDING_MODEL   = env("EMBEDDING_MODEL", "paraphrase-multilingual-MiniLM-L12-v2")
TOP_K             = int(env("TOP_K", "6"))
MIN_SIMILARITY    = float(env("MIN_SIMILARITY", "0.25"))
COLLECTION_NAME   = "langey_corpus"

# ----------------------------------------------------------------------------
# Chunking
# ----------------------------------------------------------------------------

CHUNK_TARGET_CHARS = 1200   # ~ 300 tokens
CHUNK_OVERLAP_CHARS = 200   # gentle overlap so sentences aren't sliced

_paragraph_split = re.compile(r"\n\s*\n+")
_whitespace_collapse = re.compile(r"[ \t]+")


@dataclass
class Chunk:
    text: str
    source: str            # PDF filename (no path)
    page_start: int        # 1-based
    page_end: int
    chunk_index: int       # within this PDF
    metadata: dict = field(default_factory=dict)

    def chunk_id(self) -> str:
        # Stable ID — same PDF + same chunk index = same id.
        h = hashlib.sha1(f"{self.source}::{self.chunk_index}::{self.text[:80]}".encode("utf-8")).hexdigest()[:16]
        return f"{self.source}#{self.chunk_index:04d}#{h}"


def extract_pdf_text_by_page(pdf_path: Path) -> list[str]:
    """Return a list of cleaned page-strings, indexed 0..n-1."""
    pages: list[str] = []
    with fitz.open(pdf_path) as doc:
        for page in doc:
            text = page.get_text("text") or ""
            # Light cleanup — collapse runs of spaces, normalize line endings
            text = text.replace("\r", "\n")
            text = _whitespace_collapse.sub(" ", text)
            pages.append(text.strip())
    return pages


def chunk_pages(pages: list[str], source: str) -> list[Chunk]:
    """
    Paragraph-aware chunker. Walks each page splitting on blank lines,
    accumulates paragraphs until ~CHUNK_TARGET_CHARS, then emits a Chunk.
    Tracks the page range each chunk spans so citations are accurate.
    """
    chunks: list[Chunk] = []
    buf: list[str] = []
    buf_chars = 0
    buf_page_start: Optional[int] = None
    buf_page_end: Optional[int] = None

    def flush():
        nonlocal buf, buf_chars, buf_page_start, buf_page_end
        if not buf:
            return
        text = "\n\n".join(buf).strip()
        if len(text) < 50:  # skip tiny chunks (cover pages, page numbers, etc.)
            buf, buf_chars, buf_page_start, buf_page_end = [], 0, None, None
            return
        chunks.append(Chunk(
            text=text,
            source=source,
            page_start=buf_page_start or 1,
            page_end=buf_page_end or (buf_page_start or 1),
            chunk_index=len(chunks),
        ))
        # Carry overlap into next chunk
        if CHUNK_OVERLAP_CHARS > 0 and len(text) > CHUNK_OVERLAP_CHARS:
            tail = text[-CHUNK_OVERLAP_CHARS:]
            buf = [tail]
            buf_chars = len(tail)
            buf_page_start = buf_page_end  # overlap carries the last page
        else:
            buf, buf_chars = [], 0
            buf_page_start = None
        buf_page_end = None

    for page_idx, page_text in enumerate(pages, start=1):
        if not page_text:
            continue
        paragraphs = _paragraph_split.split(page_text)
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            if buf_page_start is None:
                buf_page_start = page_idx
            buf_page_end = page_idx
            buf.append(para)
            buf_chars += len(para) + 2
            if buf_chars >= CHUNK_TARGET_CHARS:
                flush()

    flush()
    return chunks


def iter_pdfs(folder: Path) -> Iterable[Path]:
    if not folder.exists():
        return []
    return sorted(p for p in folder.glob("**/*.pdf") if p.is_file())


# ----------------------------------------------------------------------------
# Embeddings
# ----------------------------------------------------------------------------

# Embeddings strategy (512MB-friendly — local transformer models OOM-killed
# Render's free instance, both PyTorch (~1.5GB) and ONNX (~550MB+)):
#   PRIMARY : Gemini embedding API (gemini-embedding-001) — zero local RAM.
#             A background thread builds a separate "…_gemini" collection from
#             the committed chunk texts at startup (~11 batched API calls).
#   FALLBACK: BM25 keyword retrieval over the same chunks — instant, offline,
#             used while the semantic index builds or if the API is down.

GEMINI_EMBED_MODEL   = env("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
GEMINI_EMBED_DIMS    = int(env("GEMINI_EMBEDDING_DIMS", "768"))
#: The Gemini vectors used to live in a second collection, mirrored from the
#: first. That made sense while the two held *different* embeddings, but once
#: everything was rebuilt at 768 dimensions the mirror was a byte-for-byte
#: duplicate of the chunk texts — and Chroma keeps a full-text index over each
#: copy. The result was a 109 MB chroma.sqlite3, over GitHub's 100 MB file limit,
#: so the committed index could not be pushed at all. Pointing both names at one
#: collection halves the store and keeps every call site working unchanged.
GEMINI_COLLECTION    = COLLECTION_NAME
_semantic_ready = False
_semantic_error: Optional[str] = None


#: Request sizing for the embedding API. Batching by a fixed *count* is what
#: silently broke the semantic index: our grammar-book chunks average ~2,500
#: characters, so 50-per-request sent ~126k chars (~35k tokens) in one call and
#: the free tier rejected it with 429 RESOURCE_EXHAUSTED — indistinguishable, in
#: the logs, from a daily quota being used up. Batch by character budget instead,
#: so request size stays bounded no matter how large individual chunks are.
#: Calibrated against the free tier: ~50,000 chars per request succeeds,
#: ~62,500 returns 429. 36,000 leaves headroom for chunks that tokenize badly.
EMBED_MAX_CHARS_PER_REQUEST = int(env("EMBED_MAX_CHARS_PER_REQUEST", "36000"))
EMBED_MAX_ITEMS_PER_REQUEST = int(env("EMBED_MAX_ITEMS_PER_REQUEST", "16"))


def _embed_batches(texts: list[str]) -> Iterable[tuple[int, list[str]]]:
    """Yield (start_index, batch) windows that respect both caps."""
    start = 0
    while start < len(texts):
        batch: list[str] = []
        chars = 0
        i = start
        while i < len(texts) and len(batch) < EMBED_MAX_ITEMS_PER_REQUEST:
            t = texts[i]
            # Always take at least one item, even if it alone exceeds the cap.
            if batch and chars + len(t) > EMBED_MAX_CHARS_PER_REQUEST:
                break
            batch.append(t)
            chars += len(t)
            i += 1
        yield start, batch
        start = i


def _gemini_embed(texts: list[str], task: str) -> list[list[float]]:
    """Embed via the Gemini API. task: RETRIEVAL_DOCUMENT | RETRIEVAL_QUERY."""
    import numpy as np
    from google import genai
    from google.genai import types
    api_key = env("GEMINI_API_KEY")
    if not api_key:
        raise LLMError("Missing GEMINI_API_KEY for embeddings")
    client = genai.Client(api_key=api_key)
    out: list[list[float]] = []
    for _, batch in _embed_batches(texts):
        resp = client.models.embed_content(
            model=GEMINI_EMBED_MODEL,
            contents=batch,
            config=types.EmbedContentConfig(task_type=task, output_dimensionality=GEMINI_EMBED_DIMS),
        )
        for e in resp.embeddings:
            v = np.asarray(e.values, dtype=float)
            n = float(np.linalg.norm(v))
            out.append((v / n).tolist() if n > 0 else v.tolist())
    return out


#: Pacing for bulk document embedding. The free tier enforces a per-minute
#: *token* budget (~30k TPM for gemini-embedding-001), so a long ingest must be
#: rate-limited, not just retried: without this, every request after the first
#: ~90k characters in a minute comes back 429 and the run crawls through
#: backoff. Characters are used as a cheap token proxy (~4 chars/token for
#: German). Query-time embedding (RETRIEVAL_QUERY) deliberately does NOT pace or
#: retry — a learner waiting on a reply should fall back to BM25, not sit for 30s.
EMBED_CHARS_PER_MINUTE = int(env("EMBED_CHARS_PER_MINUTE", "90000"))
EMBED_MAX_RETRIES = int(env("EMBED_MAX_RETRIES", "6"))
EMBED_PROGRESS = env("EMBED_PROGRESS", "") not in ("", "0", "false", "False")


class QuotaExhausted(Exception):
    """The per-DAY embedding quota is gone. Waiting will not help today."""


#: Two different 429s wear the same status code, and telling them apart is the
#: difference between "sleep 20s and carry on" and "come back tomorrow":
#:   per-minute  → PerMinute / RetryInfo of a few seconds; retrying works.
#:   per-day     → quotaId ...PerDay..., limit 1000; retrying just burns time.
#: NOTE the free-tier day counter bills one unit per *text*, not per HTTP call,
#: so batching reduces wall-clock time but not daily consumption. A 2,900-chunk
#: corpus therefore needs ~3 days on the free tier regardless of batch size.
_DAILY_QUOTA = re.compile(r"PerDay|RequestsPerDay|per day", re.I)


def _is_daily_quota(e: Exception) -> bool:
    return "429" in str(e) and bool(_DAILY_QUOTA.search(str(e)))


def _is_transient(e: Exception) -> bool:
    msg = str(e)
    if _is_daily_quota(e):
        return False
    return "429" in msg or "RESOURCE_EXHAUSTED" in msg or "503" in msg or "UNAVAILABLE" in msg


#: Retry policy for *generation* calls (chat + stream). Deliberately far more
#: impatient than the ingest policy above: a learner is watching a cursor blink,
#: so we trade thoroughness for responsiveness. Google returns 503 UNAVAILABLE
#: when a model is momentarily oversubscribed and these clear in a second or two.
LLM_MAX_RETRIES = int(env("LLM_MAX_RETRIES", "3"))
_LLM_BACKOFF = (1.0, 3.0, 7.0)

#: Shown when the connection dies *after* tokens have already reached the
#: browser. Retrying there would duplicate text the learner can already see, so
#: we close the answer honestly instead. Mirrors the token-limit note's voice.
STREAM_CUT_NOTE = (
    "\n\n_(Verbindung zum Modell abgebrochen — die Antwort ist unvollständig. "
    "Bitte stell die Frage noch einmal oder sag „weiter“.)_"
)


def _llm_backoff(attempt: int) -> float:
    return _LLM_BACKOFF[min(attempt, len(_LLM_BACKOFF) - 1)]


def _retry_transient(fn):
    """Run `fn()`, retrying transient 429/503 with short interactive backoff.

    Daily-quota 429s are not transient and propagate immediately — see
    `_is_transient`."""
    import time
    for attempt in range(max(LLM_MAX_RETRIES, 1)):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            if not _is_transient(e) or attempt >= LLM_MAX_RETRIES - 1:
                raise
            time.sleep(_llm_backoff(attempt))
    raise RuntimeError("unreachable")


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Document embeddings (used by ingest); requires GEMINI_API_KEY.

    Retries transient quota/availability errors with escalating backoff so a
    long ingest survives free-tier rate limiting instead of dying halfway."""
    import time
    out: list[list[float]] = []
    batches = list(_embed_batches(texts))
    for n, (_, window) in enumerate(batches):
        chars = sum(len(t) for t in window)
        for attempt in range(EMBED_MAX_RETRIES):
            try:
                out.extend(_gemini_embed(window, "RETRIEVAL_DOCUMENT"))
                break
            except Exception as e:  # noqa: BLE001
                if _is_daily_quota(e):
                    raise QuotaExhausted(str(e)) from e
                if _is_transient(e) and attempt < EMBED_MAX_RETRIES - 1:
                    time.sleep(20 * (attempt + 1))
                    continue
                raise
        if EMBED_PROGRESS:
            print(f"    embedded {len(out)}/{len(texts)} chunks", flush=True)
        if n + 1 < len(batches):
            # Stay under the per-minute character budget: a batch of `chars`
            # characters entitles the next one to start `chars / rate` later.
            time.sleep(60.0 * chars / max(EMBED_CHARS_PER_MINUTE, 1))
    return out


#: The vector index is built offline by `build_index.py` and committed with the
#: repo, so the server should never spend quota rebuilding it. Set to "0" only
#: if you deliberately want the old build-on-startup behaviour.
PREBUILT_INDEX = env("PREBUILT_INDEX", "1") not in ("0", "false", "False", "")


def ensure_semantic_index() -> None:
    """
    Make the Gemini-embedded collection available.

    Normal path (PREBUILT_INDEX=1): the collection already ships in chroma_db/,
    so we just verify it covers the corpus and flip the ready flag — no API
    calls, no quota burn, instant startup.

    Legacy path (PREBUILT_INDEX=0): embed the chunks here at startup. This is
    what exhausted the free-tier quota and left retrieval on BM25; kept only as
    an escape hatch.

    Runs in a background thread at server startup; safe to call repeatedly.
    On any failure, retrieval silently stays on the BM25 fallback.
    """
    global _semantic_ready, _semantic_error
    if _semantic_ready:
        return
    try:
        src = get_collection()
        n = src.count()
        if n == 0:
            _semantic_error = "source collection empty"
            return
        client = get_chroma()
        gcol = client.get_or_create_collection(name=GEMINI_COLLECTION, metadata={"hnsw:space": "cosine"})
        have = gcol.count()

        if have >= n:
            _semantic_ready = True
            _semantic_error = None
            return

        if PREBUILT_INDEX:
            _semantic_error = (
                f"prebuilt index incomplete ({have}/{n} chunks) — run "
                f"`python build_index.py` locally and commit chroma_db/. "
                f"Using keyword retrieval until then."
            )
            return

        if not env("GEMINI_API_KEY"):
            _semantic_error = "no GEMINI_API_KEY — using keyword retrieval"
            return
        import time
        data = src.get(include=["documents", "metadatas"])
        ids, docs, metas = data["ids"], data["documents"], data["metadatas"]
        for i in range(0, len(docs), 100):
            # free-tier embedding quotas are bursty — pace batches and retry 429s
            for attempt in range(4):
                try:
                    vecs = _gemini_embed(docs[i:i + 100], "RETRIEVAL_DOCUMENT")
                    break
                except Exception as e:
                    if "429" in str(e) and attempt < 3:
                        time.sleep(30 * (attempt + 1))
                        continue
                    raise
            gcol.upsert(ids=ids[i:i + 100], documents=docs[i:i + 100],
                        metadatas=metas[i:i + 100], embeddings=vecs)
            time.sleep(10)
        _semantic_ready = True
        _semantic_error = None
    except Exception as e:  # noqa: BLE001 — never take the server down over this
        _semantic_error = f"semantic index build failed: {e}"


def semantic_status() -> dict:
    return {"semantic_ready": _semantic_ready, "note": _semantic_error}


# ---------- BM25 fallback (pure python, ~10MB RAM) ----------

_bm25 = None
_bm25_docs: list[str] = []
_bm25_metas: list[dict] = []

_GERMAN_STOP = set(("der die das den dem des ein eine einen einem einer und oder aber auch nicht "
                    "mit von zu in im am an auf für ist sind war waren wir ich du er sie es ihr man "
                    "kann muss soll will wird werden bei nach vor aus um als wie wenn dass sich").split())
_word_re = re.compile(r"[a-zA-ZäöüÄÖÜß]+")


def _bm25_tokenize(s: str) -> list[str]:
    return [t for t in _word_re.findall(s.lower()) if t not in _GERMAN_STOP and len(t) > 1]


def _digit_ratio(s: str) -> float:
    if not s:
        return 0.0
    return sum(c.isdigit() for c in s) / len(s)


def _get_bm25():
    global _bm25, _bm25_docs, _bm25_metas
    if _bm25 is None:
        from rank_bm25 import BM25Okapi
        data = get_collection().get(include=["documents", "metadatas"])
        _bm25_docs = data["documents"] or []
        _bm25_metas = data["metadatas"] or []
        _bm25 = BM25Okapi([_bm25_tokenize(d) for d in _bm25_docs] or [["leer"]])
    return _bm25


def _bm25_retrieve(query: str, k: int) -> list[Hit]:
    bm = _get_bm25()
    scores = bm.get_scores(_bm25_tokenize(query))
    # Penalize index/table-of-contents pages (page-number-dense chunks).
    adjusted = [s * (0.25 if _digit_ratio(_bm25_docs[i]) > 0.12 else 1.0) for i, s in enumerate(scores)]
    order = sorted(range(len(adjusted)), key=lambda i: -adjusted[i])[:max(k, 1)]
    top = adjusted[order[0]] if order else 0.0
    hits: list[Hit] = []
    if top <= 0:
        return hits
    for i in order:
        rel = adjusted[i] / top
        if rel < 0.45:
            continue
        m = _bm25_metas[i]
        hits.append(Hit(text=_bm25_docs[i], source=m.get("source", "?"),
                        page_start=int(m.get("page_start", 0)), page_end=int(m.get("page_end", 0)),
                        score=round(rel, 3)))
    return hits


# ----------------------------------------------------------------------------
# Vector store (ChromaDB)
# ----------------------------------------------------------------------------

_chroma_client = None


def get_chroma():
    global _chroma_client
    if _chroma_client is None:
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_collection():
    """Returns the persistent ChromaDB collection used by SprintDeutsch."""
    client = get_chroma()
    # Cosine similarity. We embed externally (sentence-transformers),
    # so we tell Chroma not to apply its own embedding function.
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(chunks: list[Chunk]):
    if not chunks:
        return 0
    col = get_collection()
    ids = [c.chunk_id() for c in chunks]
    docs = [c.text for c in chunks]
    metas = [{
        "source": c.source,
        "page_start": c.page_start,
        "page_end": c.page_end,
        "chunk_index": c.chunk_index,
    } for c in chunks]
    embeddings = embed_texts(docs)
    col.upsert(ids=ids, documents=docs, metadatas=metas, embeddings=embeddings)
    return len(chunks)


def already_ingested_sources() -> set[str]:
    """Return the set of PDF filenames already represented in the store."""
    col = get_collection()
    try:
        # Pull metadata only — fast.
        result = col.get(include=["metadatas"])
        return {m["source"] for m in (result.get("metadatas") or []) if m}
    except Exception:
        return set()


def collection_stats() -> dict:
    col = get_collection()
    try:
        count = col.count()
    except Exception:
        count = 0
    sources = sorted(already_ingested_sources())
    return {"chunks": count, "sources": sources, "source_count": len(sources)}


# ----------------------------------------------------------------------------
# Retrieval
# ----------------------------------------------------------------------------

@dataclass
class Hit:
    text: str
    source: str
    page_start: int
    page_end: int
    score: float

    def citation(self) -> str:
        if self.page_start == self.page_end:
            return f"{self.source}, p.{self.page_start}"
        return f"{self.source}, pp.{self.page_start}-{self.page_end}"


def retrieve(query: str, k: int = TOP_K, min_similarity: float = MIN_SIMILARITY) -> list[Hit]:
    if not query.strip():
        return []
    if not _semantic_ready:
        return _bm25_retrieve(query, k)
    try:
        qvec = _gemini_embed([query], "RETRIEVAL_QUERY")[0]
    except Exception:
        return _bm25_retrieve(query, k)  # API hiccup → keyword fallback
    col = get_chroma().get_or_create_collection(name=GEMINI_COLLECTION, metadata={"hnsw:space": "cosine"})
    result = col.query(
        query_embeddings=[qvec],
        n_results=k,
        include=["documents", "metadatas", "distances"],
    )
    hits: list[Hit] = []
    docs   = (result.get("documents") or [[]])[0]
    metas  = (result.get("metadatas") or [[]])[0]
    dists  = (result.get("distances") or [[]])[0]
    for doc, meta, dist in zip(docs, metas, dists):
        # Chroma cosine distance is 1 - cosine_similarity.
        sim = max(0.0, 1.0 - float(dist))
        if sim < min_similarity:
            continue
        hits.append(Hit(
            text=doc,
            source=meta.get("source", "?"),
            page_start=int(meta.get("page_start", 0)),
            page_end=int(meta.get("page_end", 0)),
            score=sim,
        ))
    return hits


# ----------------------------------------------------------------------------
# LLM providers
# ----------------------------------------------------------------------------

TUTOR_SYSTEM = """You are an expert, encouraging German tutor.

LEARNER PROFILE
- Current CEFR level: {LEVEL}
- Long-term goal: become fluent in German
- Stated weakness: needs to expand verb vocabulary, especially A1→B1 verbs
- Professional context (use for example sentences when natural): data science / algorithms / machine learning, supply-chain optimization / logistics / inventory, manufacturing — especially injection molding (Spritzgießen, Werkzeug, Zykluszeit, Granulat).

OUTPUT LANGUAGE RULES — STRICT, ALWAYS-ON
- All grammar explanations MUST be in English. Do not write German paragraphs explaining grammar.
- EVERY German sentence you produce — examples, corrections, quiz questions, translations — MUST be immediately followed by its English translation on the same line, separated by an em-dash. Format: "Wenn ich Zeit hätte, käme ich. — If I had time, I would come."
- Vocabulary lists: German term · English meaning.
- NEVER use LaTeX or math notation. No $…$, no \\rightarrow, no \\text{}. Write the
  arrow character directly: "optimieren → optimierend".
- When you name a prefix, suffix or ending, hyphenate it on the side it attaches to
  and bold it: **-d**, **-ung**, **ge-**, **un-**. The frontend highlights these for
  the learner, so the hyphen matters.
- Verb entries: Infinitiv (English meaning) · Präsens · Präteritum · Perfekt · one example sentence WITH ENGLISH TRANSLATION.
- The only place you may write German alone (without a translation) is when quoting a learner's own sentence back to them while you correct it.

HOW TO HELP
- When the learner sends German text, correct it: show the corrected sentence in bold (with translation), then list each error briefly in English with the reason.
- For verbs: meaning, principal parts, one level-appropriate example sentence (with translation), one common collocation or preposition.
- Recommend 1-3 new verbs at the end of any vocabulary discussion.
- Keep replies under ~250 words unless the learner asks for more.

USING THE LEARNER'S LIBRARY
- A retrieval system has surfaced excerpts from the learner's own German study materials (grammar books, vocabulary references). Use them as your *primary* source of truth when relevant.
- If a retrieved excerpt directly answers the question, ground your reply in it and CITE the source at the end like: [Source: Book Name, p.NN].
- If excerpts contradict each other, prefer the one closer to the learner's level and say so briefly.
- If the retrieved excerpts are off-topic for the question, ignore them silently and answer from your own knowledge — do not pretend they were helpful.
"""


class LLMError(Exception):
    pass


class BaseLLM:
    def chat(self, system: str, messages: list[dict]) -> str:
        raise NotImplementedError

    def chat_stream(self, system: str, messages: list[dict]):
        """Yield text chunks as they arrive from the model."""
        raise NotImplementedError


#: Visible-answer budget. Gemini 2.5 "thinking" tokens are charged against
#: max_output_tokens, so a small budget gets eaten by reasoning and the reply is
#: cut off mid-sentence. We disable thinking (this is a tutor, not a solver) and
#: leave enough room for a full ~250-word answer plus citations.
GEMINI_MAX_OUTPUT_TOKENS = int(env("GEMINI_MAX_OUTPUT_TOKENS", "4096"))
CLAUDE_MAX_TOKENS = int(env("CLAUDE_MAX_TOKENS", "2048"))

#: How to ask Gemini to hold back on thinking, in order of preference.
#: Support varies by model generation and the API rejects unsupported settings
#: with 400 INVALID_ARGUMENT at *request* time (not when building the config),
#: so we probe once at runtime and remember what this model accepts:
#:   "budget0" — Gemini 2.5: thinking_budget=0 turns thinking off entirely
#:   "low"     — Gemini 3.x: thinking cannot be disabled, only lowered
#:   "none"    — send no thinking config at all; rely on the token budget
_THINKING_MODES = ("budget0", "low", "none")
_thinking_mode = 0  # index into _THINKING_MODES


class GeminiLLM(BaseLLM):
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        if not api_key:
            raise LLMError("Missing GEMINI_API_KEY")
        from google import genai
        self._client = genai.Client(api_key=api_key)
        self.model = model

    def _config(self, system: str, mode: str):
        """Build a generation config for the given thinking `mode`.

        Returns None if this SDK can't express the mode, so the caller moves on
        to the next one."""
        from google.genai import types
        kwargs = dict(
            system_instruction=system,
            temperature=0.6,
            max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
        )
        if mode != "none":
            try:
                kwargs["thinking_config"] = (
                    types.ThinkingConfig(thinking_budget=0) if mode == "budget0"
                    else types.ThinkingConfig(thinking_level="low")
                )
            except (AttributeError, TypeError):
                return None
        try:
            return types.GenerateContentConfig(**kwargs)
        except TypeError:
            return None

    @staticmethod
    def _rejected_config(e: Exception) -> bool:
        """True if the model refused the thinking setting rather than the prompt."""
        msg = str(e)
        return "INVALID_ARGUMENT" in msg or "400" in msg

    def _attempt(self, call, system: str):
        """Run `call(config)` under the first thinking mode this model accepts.

        On a 400 we step down to a weaker mode and retry, remembering the
        working mode process-wide so later requests pay no penalty."""
        global _thinking_mode
        last: Optional[Exception] = None
        start = _thinking_mode
        for idx in range(start, len(_THINKING_MODES)):
            cfg = self._config(system, _THINKING_MODES[idx])
            if cfg is None:
                continue
            try:
                out = call(cfg)
                _thinking_mode = idx           # remember what worked
                return out
            except Exception as e:  # noqa: BLE001
                last = e
                if not self._rejected_config(e):
                    raise                       # a real error — don't mask it
        raise last if last else RuntimeError("no usable Gemini config")

    @staticmethod
    def _contents(messages: list[dict]):
        from google.genai import types
        # Gemini takes conversation history as a list of Content parts.
        # We render prior user/assistant turns as alternating contents.
        contents = []
        for m in messages:
            role = "user" if m["role"] == "user" else "model"
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=m["content"])]))
        return contents

    @staticmethod
    def _truncated(chunk) -> bool:
        """True if Gemini stopped because it ran out of output tokens."""
        for cand in (getattr(chunk, "candidates", None) or []):
            reason = getattr(cand, "finish_reason", None)
            if reason is not None and str(reason).upper().endswith("MAX_TOKENS"):
                return True
        return False

    def chat(self, system: str, messages: list[dict]) -> str:
        contents = self._contents(messages)
        try:
            resp = _retry_transient(lambda: self._attempt(
                lambda cfg: self._client.models.generate_content(
                    model=self.model, contents=contents, config=cfg),
                system,
            ))
        except Exception as e:
            raise LLMError(f"Gemini call failed: {e}") from e
        text = (resp.text or "").strip()
        if self._truncated(resp):
            text += "\n\n_(Antwort wegen Token-Limit gekürzt — frag nach „weiter“.)_"
        return text or "(empty reply)"

    def chat_stream(self, system: str, messages: list[dict]):
        contents = self._contents(messages)

        def open_stream(cfg):
            # generate_content_stream is lazy — a bad config only raises once we
            # pull the first chunk, so force that here where _attempt can see it.
            stream = self._client.models.generate_content_stream(
                model=self.model, contents=contents, config=cfg)
            it = iter(stream)
            try:
                first = next(it)
            except StopIteration:
                return None, iter(())
            return first, it

        # A 503 can land either while opening the stream or halfway through it.
        # Before the first token reaches the browser a retry is invisible, so we
        # take it; afterwards it would repeat text the learner has already read,
        # so we stop and say so. `emitted` is the line between those two worlds.
        import time
        emitted = False
        for attempt in range(max(LLM_MAX_RETRIES, 1)):
            hit_limit = False
            try:
                first, rest = self._attempt(open_stream, system)
                for chunk in itertools.chain(
                        [first] if first is not None else [], rest):
                    text = getattr(chunk, "text", None)
                    if text:
                        emitted = True
                        yield text
                    if self._truncated(chunk):
                        hit_limit = True
                break                              # drained cleanly
            except Exception as e:  # noqa: BLE001
                retriable = _is_transient(e) and not emitted
                if not retriable or attempt >= LLM_MAX_RETRIES - 1:
                    if emitted and _is_transient(e):
                        yield STREAM_CUT_NOTE       # keep the partial answer
                        return
                    raise LLMError(f"Gemini stream failed: {e}") from e
                time.sleep(_llm_backoff(attempt))
        if hit_limit:
            yield "\n\n_(Antwort wegen Token-Limit gekürzt — frag nach „weiter“.)_"


class ClaudeLLM(BaseLLM):
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6"):
        if not api_key:
            raise LLMError("Missing ANTHROPIC_API_KEY")
        from anthropic import Anthropic
        self._client = Anthropic(api_key=api_key)
        self.model = model

    def chat(self, system: str, messages: list[dict]) -> str:
        try:
            resp = self._client.messages.create(
                model=self.model,
                max_tokens=CLAUDE_MAX_TOKENS,
                system=system,
                messages=[{"role": m["role"], "content": m["content"]} for m in messages],
            )
        except Exception as e:
            raise LLMError(f"Claude call failed: {e}") from e
        parts = [b.text for b in resp.content if getattr(b, "type", "") == "text"]
        return ("\n".join(parts)).strip() or "(empty reply)"

    def chat_stream(self, system: str, messages: list[dict]):
        try:
            with self._client.messages.stream(
                model=self.model,
                max_tokens=CLAUDE_MAX_TOKENS,
                system=system,
                messages=[{"role": m["role"], "content": m["content"]} for m in messages],
            ) as stream:
                for text in stream.text_stream:
                    if text:
                        yield text
        except Exception as e:
            raise LLMError(f"Claude stream failed: {e}") from e


def get_llm(provider: Optional[str] = None) -> BaseLLM:
    provider = (provider or env("LLM_PROVIDER", "gemini")).lower()
    if provider == "gemini":
        return GeminiLLM(env("GEMINI_API_KEY"), env("GEMINI_MODEL", "gemini-2.5-flash"))
    if provider == "claude":
        return ClaudeLLM(env("ANTHROPIC_API_KEY"), env("ANTHROPIC_MODEL", "claude-sonnet-4-6"))
    raise LLMError(f"Unknown LLM provider: {provider!r}")


# ----------------------------------------------------------------------------
# High-level chat helper
# ----------------------------------------------------------------------------

# ----------------------------------------------------------------------------
# High-level chat helper
# ----------------------------------------------------------------------------

def build_rag_context(hits: list[Hit], max_chars: int = 4500) -> str:
    """Render retrieved hits as a prompt-friendly block, capped at max_chars."""
    if not hits:
        return ""
    lines = ["LEARNER LIBRARY EXCERPTS (use these to ground your answer):", ""]
    used = 0
    for i, h in enumerate(hits, 1):
        snippet = h.text.strip()
        # Trim long snippets so we don't burn context on one chunk
        if len(snippet) > 1400:
            snippet = snippet[:1400] + " …"
        block = f"[{i}] {h.citation()}\n{snippet}\n"
        if used + len(block) > max_chars:
            break
        lines.append(block)
        used += len(block)
    return "\n".join(lines)


def chat_with_rag(
    user_message: str,
    history: list[dict],
    level: str,
    provider: Optional[str] = None,
    use_rag: bool = True,
    rag_query: Optional[str] = None,
) -> dict:
    """
    Run a single tutor turn. Returns:
      { reply, sources: [...], provider, rag_used }
    """
    query_for_retrieval = (rag_query or user_message).strip() or user_message
    hits: list[Hit] = retrieve(query_for_retrieval) if use_rag else []
    context = build_rag_context(hits) if hits else ""

    system = TUTOR_SYSTEM.replace("{LEVEL}", level)
    if context:
        system += "\n\n" + context

    messages = list(history) + [{"role": "user", "content": user_message}]
    llm = get_llm(provider)
    reply = llm.chat(system=system, messages=messages)

    return {
        "reply": reply,
        "provider": provider or env("LLM_PROVIDER", "gemini"),
        "sources": [{
            "source": h.source,
            "page_start": h.page_start,
            "page_end": h.page_end,
            "score": round(h.score, 3),
            "citation": h.citation(),
            "preview": (h.text[:240] + "…") if len(h.text) > 240 else h.text,
        } for h in hits],
        "rag_used": bool(hits),
    }


def chat_with_rag_stream(
    user_message: str,
    history: list[dict],
    level: str,
    provider: Optional[str] = None,
    use_rag: bool = True,
    rag_query: Optional[str] = None,
):
    """
    Generator yielding Server-Sent-Events frames:
      event: sources  -> JSON with retrieved sources + provider + rag_used
      event: chunk    -> JSON {"text": "<delta>"}
      event: error    -> JSON {"error": "<message>"}
      event: done     -> JSON {}
    Reuses TUTOR_SYSTEM and the RAG retrieval pipeline.
    """
    query_for_retrieval = (rag_query or user_message).strip() or user_message
    hits: list[Hit] = retrieve(query_for_retrieval) if use_rag else []
    context = build_rag_context(hits) if hits else ""

    system = TUTOR_SYSTEM.replace("{LEVEL}", level)
    if context:
        system += "\n\n" + context

    messages = list(history) + [{"role": "user", "content": user_message}]

    # 1) Sources first — frontend can paint the citations badge immediately.
    sources_payload = {
        "sources": [{
            "source": h.source,
            "page_start": h.page_start,
            "page_end": h.page_end,
            "score": round(h.score, 3),
            "citation": h.citation(),
            "preview": (h.text[:240] + "…") if len(h.text) > 240 else h.text,
        } for h in hits],
        "provider": provider or env("LLM_PROVIDER", "gemini"),
        "rag_used": bool(hits),
    }
    yield f"event: sources\ndata: {json.dumps(sources_payload, ensure_ascii=False)}\n\n"

    # 2) Stream the model's output.
    try:
        llm = get_llm(provider)
        for chunk in llm.chat_stream(system=system, messages=messages):
            yield f"event: chunk\ndata: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
    except LLMError as e:
        yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
    except Exception as e:
        yield f"event: error\ndata: {json.dumps({'error': f'Unexpected: {e}'})}\n\n"

    # 3) Done — frontend uses this to flip streaming=false even if no chunks arrived.
    yield "event: done\ndata: {}\n\n"