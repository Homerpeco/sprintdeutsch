// Shared server-side helper for the SprintDeutsch AI features
// (Verb Scanner → /api/verb-scan, Speaking coach → /api/speech-assess).
//
// SECURITY — read before changing:
//   The Gemini key lives ONLY here, in the serverless function's environment, as
//   GEMINI_API_KEY. It is never sent to the browser. Until 2026-10-04 the React app
//   called Gemini directly with VITE_GEMINI_API_KEY; Vite compiles every VITE_* value
//   into the public JavaScript bundle as plain text, so the key could be copied by
//   anyone and was abused, and Google suspended the project. Never read a secret from a
//   VITE_* variable, and never put a Gemini key in client code again.
//
//   The endpoints are also locked with the sync key the app already uses for /api/verbs
//   (VERB_SYNC_SECRET), so strangers cannot spend the quota through this site either.
//   _guard.js adds: a minimum key length, a lock after repeated wrong keys, and a daily
//   ceiling per function.
import { checkSyncKey, takeDailyBudget } from './_guard.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';

function fail(status, code, message, fatal = false) {
  return { status, body: { error: { code, message, fatal } } };
}

// True when the request may proceed. Otherwise the response has already been sent.
// `fatal: true` tells the browser not to retry or fall back to another model.
export function guard(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: { code: 'method', message: 'method not allowed', fatal: true } });
    return false;
  }
  // Sync key: must be long, and repeated wrong guesses lock the address (see _guard.js).
  const auth = checkSyncKey(req);
  if (!auth.ok) {
    if (auth.retryAfter) res.setHeader('Retry-After', String(auth.retryAfter));
    res.status(auth.status).json({ error: { code: auth.code, message: auth.message, fatal: true, retryAfter: auth.retryAfter } });
    return false;
  }
  if (!process.env.GEMINI_API_KEY) {
    res.status(503).json({ error: { code: 'not-configured', fatal: true,
      message: 'GEMINI_API_KEY is not set in the Vercel project.' } });
    return false;
  }
  return true;
}

// Daily ceiling for one function (see _guard.js). True when the request may go on to
// Gemini; otherwise the response has already been sent. Call it after the input checks,
// so that rejected requests do not use up the day's allowance.
export function withinDailyLimit(res, route) {
  const b = takeDailyBudget(route);
  if (b.ok) return true;
  res.setHeader('Retry-After', String(b.retryAfter));
  res.status(b.status).json({ error: { code: b.code, message: b.message, fatal: true, retryAfter: b.retryAfter } });
  return false;
}

export function readBody(req) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  return body && typeof body === 'object' ? body : {};
}

// Free text that ends up inside a prompt: one line, no quotes, bounded length.
export function cleanText(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f"`\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// One upstream attempt, answered as {status, body} for the browser. The browser keeps
// its retry + model-fallback loop and says which model to try, so every invocation
// stays short. The key travels in a header, never in the URL.
export async function generateJson({ model, parts, generationConfig, timeoutMs = 50000,
  fetchImpl = fetch, key = process.env.GEMINI_API_KEY }) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const scrub = s => String(s).split(key).join('[key]');
  try {
    const res = await fetchImpl(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts }], generationConfig }),
      signal: ctl.signal,
    });
    let json = null;
    try { json = await res.json(); } catch { /* non-JSON upstream answer */ }
    if (res.ok) {
      const cands = (json && json.candidates) || [];
      const ps = (cands[0] && cands[0].content && cands[0].content.parts) || [];
      // Gemini 3.x returns a hidden "thought" part first: skip it.
      const text = (ps.find(p => p.text && !p.thought) || {}).text;
      if (!text) return fail(503, 'empty', 'The model returned no answer.');
      try { return { status: 200, body: { data: JSON.parse(text) } }; }
      catch { return fail(503, 'empty', 'The model returned an unreadable answer.'); }
    }
    const msg = scrub((json && json.error && json.error.message) || `HTTP ${res.status}`);
    if (res.status === 401 || res.status === 403 || (res.status === 400 && /api[_ ]?key/i.test(msg))) {
      return fail(502, 'key-rejected', msg, true);
    }
    if (res.status === 400) return fail(400, 'bad-request', msg, true);
    if (res.status === 429) return fail(429, 'quota', msg);
    return fail(503, 'upstream', msg); // 404 (model retired) and 5xx → retry / next model
  } catch (err) {
    if (err && err.name === 'AbortError') return fail(504, 'timeout', 'timeout');
    return fail(503, 'upstream', scrub((err && err.message) || err));
  } finally {
    clearTimeout(timer);
  }
}
