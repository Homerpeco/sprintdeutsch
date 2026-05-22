# Langey — Handoff to Claude Code

A clickable React prototype of a German learning app (replicating langey.com) is
already built in this folder. Read this file before doing anything else, then
open `index.html` in a browser to see the working state.

## Goal

Help the user (currently B1–B2 in German) reach C1+ fluency, with a heavy emphasis
on **verb mastery** (especially principal parts + rektion for A1→B1 verbs) and
**grammar internalization** (spaced-repetition over a 111-topic curriculum
spanning A1 → C1).

## What exists

**Prototype (single file: `index.html`)** — ~130 KB, React via CDN + Babel
standalone + Tailwind CDN. Renders five top-level sections:

- **Roadmap** — per-level milestones (vocab, verbs, grammar topics, study hours)
- **Lern** — three drills: *Vocabulary* (flashcards over 500 verbs), *Verb Matrix*
  (form-based rapid-fire principal-parts + rektion test, 10 seed verbs), *Grammar*
  (111 topic cards across A1–C1, 10 backed by Excel library counts)
- **Practice** — Speaking / Writing / Reading / Listening with AI tutor handoff
- **Wiederholung** — SM-2 spaced-repetition queue for grammar topics
- **Stats** — streak, learned verbs, practice activity

**Data layer (`langey-data.js`)** — auto-generated from the user's 26 Excel files
in the project folder:
- 500 verbs (100 per CEFR level) with conjugations
- 117 Nomen-Verb-Verbindungen (Funktionsverbgefüge)
- 100 reflexive verbs with prepositions
- 100 separable verbs
- 50 adjective + preposition collocations
- 48 verb + preposition collocations
- 10 modal particles, 8 passive constructions

**Backend (`backend/`)** — FastAPI + ChromaDB + sentence-transformers + provider-
agnostic LLM (Gemini Flash by default, Claude as alternative).
- `rag.py` — chunking (paragraph-aware, page-tagged), retrieval, LLM clients
- `ingest.py` — idempotent PDF ingestion CLI with `--limit`, `--only`, `--reset`,
  `--stats`
- `app.py` — `/chat`, `/search`, `/library/stats`, `/health` endpoints. CORS open
  for the file:// React app.
- `.env.example` — provider keys, paths, embedding model
- Smoke-tested on 3 of the user's grammar PDFs (~0.2s each via PyMuPDF + the
  current chunker)

**SRS engine** — SM-2, persisted to localStorage. Two separate namespaces:
- `state.srs` — grammar topics, keyed by `<level>::<topic>`
- `state.verbMatrixSrs` — verb matrix, keyed by infinitive

**AI Tutor** — slide-out chat panel in the React app. Calls `localhost:8000/chat`.
Renders source citations under each AI message. Two seeded prompts:
- `buildLearnPrompt(level, topic, contextBlock)` — explanation + 3 examples
- `buildQuizPrompt(level, topic, contextBlock)` — 5-question quiz with rektion focus

## Critical technical choices to preserve

1. **Strict-English output rule.** The `TUTOR_SYSTEM` in `rag.py` forces all grammar
   explanations to be in English and every German sentence to be immediately
   followed by its English translation. Do not soften this — the user explicitly
   wants this for clarity over immersion.

2. **Honor-system SRS rating.** No auto-grading from AI quiz output. The user
   wants agency to distinguish "fundamental error" from "careless typo."

3. **Manual Context Domain.** Stored in `state.contextDomain` (persisted to
   localStorage). Used only by Quiz/Learn prompts, NOT by ad-hoc chat. Four
   presets (manufacturing/academic/software/none) plus free-form textarea.
   Ad-hoc chat is intentionally kept domain-neutral.

4. **rag_query parameter.** The frontend passes the bare topic name as
   `rag_query` so ChromaDB retrieval is clean instead of being polluted by the
   verbose meta-prompt sent as the user message. Don't remove this.

5. **Two SRS namespaces.** Grammar topics and verb matrix are kept separate so
   Wiederholung stays grammar-focused. User has approved this split.

## Known limitations

- **Scanned PDFs yield zero chunks.** Some grammar books in the library are
  scans without OCR. Tesseract integration is needed; not yet wired.
- **Chunker is paragraph-aware, not layout-aware.** A Hammer's conjugation
  table gets sliced mid-row. Real fix needs section-heading detection and
  table preservation.
- **API key lives in `.env` on disk.** Fine for local dev, must be moved to a
  secret manager before any deployment.
- **No build step.** Single HTML file via Babel standalone + CDN. Fast to
  iterate, but doesn't scale — needs Vite+React conversion before adding
  routing, tests, or component splitting.
- **No streaming responses** from the backend. `/chat` is request/response.
  Adding `/chat/stream` would noticeably improve perceived latency.
- **No deployment.** Runs locally only. Fly.io / Railway / Render would all
  work for the FastAPI backend.

## Files outside this folder

- User's grammar PDFs: `/Volumes/G-DRIVE 4 TB/John/LANGUAGE LEARNING/German/BonnLingua/Grammar books/` (22 books, 630 MB)
- Additional learning PDFs: `/Volumes/G-DRIVE 4 TB/John/LANGUAGE LEARNING/German/German Language Learning Pack/`

Point `PDF_FOLDER` in `backend/.env` at one of these (or both, via symlink)
before running `python ingest.py`.

## Suggested first task: harden the prototype into a real project

1. **Convert `index.html` → Vite + React project.** Split components into files
   under `src/components/`. Move seed data to JSON files under `src/data/`.
   Replace `<script type="text/babel">` with a proper build. Keep all
   functionality.
2. **Move the LLM key off the browser-visible path entirely.** Frontend should
   not even know which provider is configured — backend decides.
3. **Add streaming.** New endpoint `/chat/stream` returning Server-Sent Events
   so the chat reply paints as it's generated.
4. **OCR fallback for scanned PDFs.** Detect zero-extractable-text PDFs in
   `ingest.py`; route them through Tesseract before chunking.
5. **Layout-aware chunking.** Use PyMuPDF's block / dict modes to detect
   headings and tables. Don't split tables across chunks.
6. **Deploy.** Backend → Fly.io or Railway (Docker). Frontend → static hosting
   (Netlify, Vercel) once it's a Vite project.

## How the user works

- Wants to be told when something is a real engineering project vs. quick polish.
- Appreciates being asked clarifying questions before big architectural moves.
- Replies in detail when given specific design choices to react to.
- Goal is mastery, not just task completion — so feedback that says
  "your A2 list has Genitiv but Goethe puts it at B1" is welcome.

## File map

```
replicate Langey/
├── HANDOFF.md            ← you are here
├── index.html            ← the React prototype (single file)
├── langey-data.js        ← auto-generated data layer from Excel
├── backend/
│   ├── app.py
│   ├── ingest.py
│   ├── rag.py
│   ├── requirements.txt
│   ├── README.md
│   ├── .env.example
│   └── .gitignore
└── *.xlsx                ← 26 source Excel files (verbs, grammar, NVV, etc.)
```
