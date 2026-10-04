// Access limits shared by the four functions that spend Gemini quota:
// /api/verb-scan, /api/speech-assess, /api/recall-tts and /api/recall-cues.
//
// Three protections, in the order they are checked:
//
// 1. The sync key must be long. With fewer than MIN_SYNC_KEY_LENGTH characters in
//    VERB_SYNC_SECRET these functions refuse to work at all. This is the real protection
//    against guessing: a long random key cannot be found by trying combinations, however
//    many attempts are made and wherever they are counted.
//
// 2. Guess lock. An address that sends WRONG_KEYS_BEFORE_LOCK different wrong keys within
//    LOCK_WINDOW_MS is refused (429) for the same length of time, even with the right key.
//    Only *different* wrong keys count, so one device that still holds an old key after
//    the key was changed cannot lock everybody out. A missing key is not a guess.
//
// 3. Daily ceiling. Each function serves at most DAILY_LIMITS[route] requests per UTC day.
//
// Limits 2 and 3 are counted in the memory of the running function, because the project
// has no shared counter store. Vercel keeps a function in memory while requests keep
// arriving, so the counts hold during sustained guessing or abuse, but they start again
// when a function is restarted and are separate per function. Treat them as a brake, not
// a guarantee. The guarantees are the key length above and, for usage, Google's own
// free-tier limit on the Gemini key.
import { createHash, timingSafeEqual } from 'node:crypto';

export const MIN_SYNC_KEY_LENGTH = 24;
export const WRONG_KEYS_BEFORE_LOCK = 5;
export const LOCK_WINDOW_MS = 15 * 60 * 1000;
export const DAILY_LIMITS = {
  'verb-scan': 200,      // Verb Scanner lookups (one search can use up to 4)
  'speech-assess': 80,   // Speaking coach assessments (one take can use up to 4)
  'recall-tts': 500,     // RecallDeutsch voice recordings
  'recall-cues': 100,    // RecallDeutsch cue batches
};

const MAX_TRACKED_ADDRESSES = 2000;
const attempts = new Map(); // address -> { first, until, keys:Set<string> }
const spent = new Map();    // route -> { day, n }

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Vercel puts the caller's address in these headers itself; a client cannot choose it.
export function clientAddress(req) {
  const h = req.headers || {};
  const first = v => String(Array.isArray(v) ? v[0] : (v || '')).split(',')[0].trim();
  return first(h['x-real-ip']) || first(h['x-forwarded-for']) || 'unknown';
}

function prune(now) {
  if (attempts.size <= MAX_TRACKED_ADDRESSES) return;
  for (const [addr, rec] of attempts) {
    if (rec.until <= now && now - rec.first > LOCK_WINDOW_MS) attempts.delete(addr);
  }
  // still too many (a flood of fresh addresses): drop the oldest entries
  while (attempts.size > MAX_TRACKED_ADDRESSES) attempts.delete(attempts.keys().next().value);
}

// → { ok: true } or { ok: false, status, code, message, retryAfter }
export function checkSyncKey(req, now = Date.now()) {
  const secret = process.env.VERB_SYNC_SECRET || '';
  if (!secret) {
    return { ok: false, status: 503, code: 'not-configured', retryAfter: 0,
      message: 'VERB_SYNC_SECRET is not set in the Vercel project.' };
  }
  if (secret.length < MIN_SYNC_KEY_LENGTH) {
    return { ok: false, status: 503, code: 'not-configured', retryAfter: 0,
      message: `VERB_SYNC_SECRET is too short for the AI features: it must have at least ${MIN_SYNC_KEY_LENGTH} characters.` };
  }
  const addr = clientAddress(req);
  let rec = attempts.get(addr);
  if (rec && rec.until > now) {
    return { ok: false, status: 429, code: 'locked', retryAfter: Math.ceil((rec.until - now) / 1000),
      message: 'Too many different wrong sync keys from this address. Try again later.' };
  }
  const given = String((req.headers && req.headers['x-sync-key']) || '');
  if (same(given, secret)) {
    if (rec) attempts.delete(addr);
    return { ok: true };
  }
  if (given) {
    if (!rec || now - rec.first > LOCK_WINDOW_MS) rec = { first: now, until: 0, keys: new Set() };
    rec.keys.add(createHash('sha256').update(given).digest('hex').slice(0, 16));
    if (rec.keys.size >= WRONG_KEYS_BEFORE_LOCK) { rec.until = now + LOCK_WINDOW_MS; rec.keys.clear(); rec.first = now; }
    attempts.set(addr, rec);
    prune(now);
  }
  return { ok: false, status: 401, code: 'sync-key', retryAfter: 0, message: 'sync key required' };
}

// Counts one request against the route's daily ceiling.
// → { ok: true, used, limit } or { ok: false, status: 429, code: 'daily-limit', message, retryAfter }
export function takeDailyBudget(route, now = Date.now()) {
  const limit = DAILY_LIMITS[route];
  if (!limit) return { ok: true, used: 0, limit: 0 };
  const day = new Date(now).toISOString().slice(0, 10);
  let s = spent.get(route);
  if (!s || s.day !== day) s = { day, n: 0 };
  if (s.n >= limit) {
    spent.set(route, s);
    const midnight = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + 1);
    return { ok: false, status: 429, code: 'daily-limit', retryAfter: Math.max(60, Math.ceil((midnight - now) / 1000)),
      message: `The daily limit of ${limit} requests for this feature is reached. It starts again at midnight UTC.` };
  }
  s.n += 1;
  spent.set(route, s);
  return { ok: true, used: s.n, limit };
}

// For tests only.
export function _resetGuard() { attempts.clear(); spent.clear(); }
