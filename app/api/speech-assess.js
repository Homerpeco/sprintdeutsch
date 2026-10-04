// POST /api/speech-assess — the Speaking coach's pronunciation assessment, run on the
// server so that no Gemini key is ever shipped to the browser (see _gemini.js).
// Headers: x-sync-key (same key as /api/verbs).
// Body: {"audio": "<base64 WAV>", "mode": "free"|"read", "sentence": "...", "topic": "...",
//        "level": "B2", "m": 0}   m = which model to try (0 = first choice, 1 = fallback).
// 200 {"data": {...}} or {"error": {code, message, fatal}} with 400/401/429/502/503/504.
// Limits (key length, guess lock, daily ceiling): see _guard.js.
// The recording is passed straight to Gemini and is not stored anywhere.
// Vercel rejects request bodies over 4.5 MB (413) before this code runs; the browser
// keeps the WAV under that limit (see audioBufferToWav in PracticeView.jsx).
import { guard, readBody, cleanText, generateJson, withinDailyLimit } from './_gemini.js';

export const maxDuration = 60;

// Current -latest aliases (Gemini 3.x), audio-capable. No thinkingConfig.
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const MAX_AUDIO_B64 = 6_000_000;

const GENERATION_CONFIG = {
  temperature: 0.3,
  // No thinkingConfig: Gemini 3.x models reject thinkingBudget:0 (400). We let
  // the model think and skip the "thought" part when parsing the JSON.
  responseMimeType: 'application/json',
  responseSchema: {
    type: 'OBJECT',
    properties: {
      transcript: { type: 'STRING' },
      overall: { type: 'INTEGER' },
      pronunciation: { type: 'INTEGER' },
      intonation: { type: 'INTEGER' },
      accent: { type: 'INTEGER' },
      strengths: { type: 'STRING' },
      issues: { type: 'ARRAY', items: { type: 'OBJECT', properties: { sound: { type: 'STRING' }, tip: { type: 'STRING' } }, propertyOrdering: ['sound', 'tip'] } },
      summary: { type: 'STRING' },
    },
    propertyOrdering: ['transcript', 'overall', 'pronunciation', 'intonation', 'accent', 'strengths', 'issues', 'summary'],
  },
};

function isWavBase64(audio) {
  if (typeof audio !== 'string' || audio.length < 200 || audio.length > MAX_AUDIO_B64) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(audio)) return false;
  const head = Buffer.from(audio.slice(0, 16), 'base64').toString('latin1');
  return head.slice(0, 4) === 'RIFF' && head.slice(8, 12) === 'WAVE';
}

function buildPrompt({ mode, sentence, topic, level }) {
  const task = mode === 'read'
    ? `The learner was asked to READ this sentence aloud:\n\n"${sentence}"\n\nCompare what they said to this exact target.`
    : `The learner is practicing a spoken PRESENTATION (about 5–10 sentences of free, spontaneous German)${topic ? ` on the topic: "${topic}"` : ' on an open topic of their choice'}. There is no target text — assess the connected speech as delivered.`;
  return `You are a strict but encouraging German pronunciation coach for a CEFR ${level} learner. ${task}

Listen to the attached audio and assess ONLY pronunciation and delivery — NOT grammar, vocabulary or content. Judge three things:
- "pronunciation": accuracy of individual sounds/phonemes across the whole recording (Umlaute ö/ü/ä, the ich- vs ach-Laut, r, z/tz, sch, sp/st, long vs short vowels, word endings).
- "intonation": sentence melody, word/sentence stress and rhythm (Satzmelodie und Betonung), and — for a presentation — natural phrasing and pacing.
- "accent": how close to a native German speaker overall (naturalness and fluency; note excessive hesitation or filler sounds like "ähm").

Score each 0–100 and give an "overall" 0–100. In "transcript", write out what you actually heard (the full speech, not a fixed sentence). In "issues", list up to 5 specific words or sounds that need work, each with a short, concrete English tip on how to produce it. Keep "strengths" and "summary" short and in English. Be honest but motivating, and tailor advice to someone preparing to give presentations.`;
}

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  const body = readBody(req);
  if (!isWavBase64(body.audio)) {
    return res.status(400).json({ error: { code: 'bad-request', message: 'A WAV recording is required.', fatal: true } });
  }
  const mode = body.mode === 'read' ? 'read' : 'free';
  const sentence = cleanText(body.sentence, 400);
  const topic = cleanText(body.topic, 200);
  const level = LEVELS.has(body.level) ? body.level : 'B1';
  if (mode === 'read' && !sentence) {
    return res.status(400).json({ error: { code: 'bad-request', message: 'The target sentence is missing.', fatal: true } });
  }
  if (!withinDailyLimit(res, 'speech-assess')) return;
  const model = MODELS[Number(body.m) === 1 ? 1 : 0];
  const out = await generateJson({
    model,
    parts: [{ text: buildPrompt({ mode, sentence, topic, level }) },
            { inline_data: { mime_type: 'audio/wav', data: body.audio } }],
    generationConfig: GENERATION_CONFIG,
    timeoutMs: 50000,
  });
  res.setHeader('X-Ai-Model', model);
  return res.status(out.status).json(out.body);
}
