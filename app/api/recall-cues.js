// POST /api/recall-cues — short Spanish + English recall cues for the RecallDeutsch phone app.
// Uses the Gemini key this project already has (VITE_GEMINI_API_KEY) and the same key as /api/verbs
// (VERB_SYNC_SECRET). Nothing in the SprintDeutsch app itself uses this file.
// Body: {"items": [{"id", "de", "meaning"}]} (max 30) → {"cues": [{"id", "es": [...], "en": [...]}], "model"}
import { timingSafeEqual } from 'node:crypto';
import { makeCues, MAX_ITEMS } from './_recall_cues.js';

export const maxDuration = 60;

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
  if (!secret || !same(req.headers['x-sync-key'] || '', secret)) return res.status(401).json({ error: 'unauthorized' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const items = (Array.isArray(body && body.items) ? body.items : [])
    .slice(0, MAX_ITEMS)
    .map(i => ({ id: String(i && i.id || ''), de: String(i && i.de || '').slice(0, 120), meaning: String(i && i.meaning || '').slice(0, 600) }))
    .filter(i => i.id && i.de);
  if (!items.length) return res.status(400).json({ error: 'items required' });
  try {
    return res.status(200).json(await makeCues(items));
  } catch (err) {
    const status = err.status === 429 ? 429 : err.status === 500 ? 500 : 502;
    if (err.retryAfter) res.setHeader('Retry-After', String(err.retryAfter));
    return res.status(status).json({ error: status === 429 ? 'quota' : 'cues-failed', detail: String(err.message || err), retryAfter: err.retryAfter || 0 });
  }
}
