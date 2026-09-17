// POST /api/recall-tts — Gemini voice recordings for the RecallDeutsch phone app.
// Lives in SprintDeutsch so it can use the Gemini key this project already has
// (VITE_GEMINI_API_KEY). Protected by the same key as /api/verbs (VERB_SYNC_SECRET).
// Body: {"text": "...", "voice": "Kore"} → 200 audio/mpeg, or JSON error (429 + retryAfter on quota).
// Independent of the SprintDeutsch app itself: nothing in the React app imports this.
import { timingSafeEqual } from 'node:crypto';
import { speakToMp3 } from './_recall_audio.js';

export const maxDuration = 60;

const VOICES = new Set(['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir', 'Leda', 'Orus', 'Zephyr']);

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const secret = process.env.VERB_SYNC_SECRET || '';
  if (!secret || !same(req.headers['x-sync-key'] || '', secret)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const text = String(body && body.text || '').replace(/[^\S\n]+/g, ' ').replace(/ *\n[\n ]*/g, '\n').trim();
  const voice = VOICES.has(body && body.voice) ? body.voice : 'Kore';
  if (!text) return res.status(400).json({ error: 'text required' });
  if (text.length > 1200) return res.status(400).json({ error: 'text too long (max 1200 characters)' });
  try {
    const { mp3, model, seconds } = await speakToMp3(text, { voice });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Tts-Model', model);
    if (seconds != null) res.setHeader('X-Audio-Seconds', String(seconds));
    return res.status(200).send(mp3);
  } catch (err) {
    const status = err.status === 429 ? 429 : (err.status === 500 ? 500 : 502);
    if (err.retryAfter) res.setHeader('Retry-After', String(err.retryAfter));
    return res.status(status).json({ error: status === 429 ? 'quota' : 'tts-failed',
      detail: String(err.message || err), retryAfter: err.retryAfter || 0, model: err.model || '' });
  }
}
