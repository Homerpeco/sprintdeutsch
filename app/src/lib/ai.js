// Client for the app's own AI endpoints (/api/verb-scan, /api/speech-assess).
//
// SECURITY: there is deliberately NO Gemini API key in the browser. Everything Vite
// bundles is public, and a VITE_* variable is compiled into the bundle as plain text —
// that is how the previous key was copied and abused (October 2026). The key now lives
// only in the serverless functions (GEMINI_API_KEY in Vercel). Never read a secret
// through import.meta.env again.
//
// The endpoints are protected by the same sync key as /api/verbs (VERB_SYNC_SECRET in
// Vercel). The Verb Meister tracker keeps it in localStorage under `de_verb_sync_key`;
// this reuses that entry and asks once if this browser does not have it yet.

const SYNC_KEY_KEY = 'de_verb_sync_key';

// The key travels in an HTTP header, and a browser refuses to send a header that holds
// characters outside plain text: fetch() throws before anything leaves the machine. The
// usual culprit is a curly apostrophe that a phone or Mac keyboard types instead of a
// straight one. A key like that can never work, so it must not be kept: a saved one is
// removed and asked for again, a typed one is not saved. (October 2026: a saved key of
// this kind left the Verb Scanner stuck on "non ISO-8859-1 code point" with no way out.)
export function sendableKey(k) {
  return typeof k === 'string' && /^[\x20-\x7E]+$/.test(k);
}

const BAD_KEY_NOTE = 'It contains a character that cannot be sent, often a curly apostrophe typed by the keyboard instead of a straight one. A sync key should use only letters and digits.';

// Returns { key, dropped }: `dropped` means a saved key was unusable and has been removed.
function readSyncKey() {
  let k = '';
  try { k = localStorage.getItem(SYNC_KEY_KEY) || ''; } catch (e) { return { key: '', dropped: false }; }
  if (!k || sendableKey(k)) return { key: k, dropped: false };
  try { localStorage.removeItem(SYNC_KEY_KEY); } catch (e) { /* private mode */ }
  return { key: '', dropped: true };
}

// why: 'none' (no key saved) | 'refused' (the server said no) | 'unsendable' (removed above).
// Returns { key, bad }: `bad` means the typed key was unusable and was not saved.
function askSyncKey(why) {
  const intro = why === 'refused' ? 'The saved sync key was not accepted.\n'
    : why === 'unsendable' ? 'The saved sync key could not be used and was removed. ' + BAD_KEY_NOTE + '\n'
    : 'The AI features are protected by your sync key.\n';
  let k = null;
  try {
    k = window.prompt(intro + 'Enter your sync key (the VERB_SYNC_SECRET you set in Vercel):');
  } catch (e) { /* dialogs blocked */ }
  k = (k || '').trim();
  if (k && !sendableKey(k)) return { key: '', bad: true };
  if (k) { try { localStorage.setItem(SYNC_KEY_KEY, k); } catch (e) { /* private mode */ } }
  return { key: k, bad: false };
}

async function postOnce(path, body, timeoutMs, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['x-sync-key'] = key;
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    let json = null;
    try { json = await res.json(); } catch (e) { /* not JSON (e.g. a 413 or a missing route) */ }
    return { res, json };
  } finally {
    clearTimeout(timer);
  }
}

// Never throws. Resolves to {ok:true, data} or
// {ok:false, status, code, message, fatal, timeout}; `fatal` means "do not retry".
export async function aiPost(path, body, timeoutMs = 45000) {
  try {
    const saved = readSyncKey();
    let key = saved.key;
    let { res, json } = await postOnce(path, body, timeoutMs, key);
    if (res.status === 401) {
      const asked = askSyncKey(saved.dropped ? 'unsendable' : key ? 'refused' : 'none');
      if (asked.bad) return { ok: false, status: 401, code: 'sync-key-chars', fatal: true, message: 'sync key not saved' };
      key = asked.key;
      if (!key) return { ok: false, status: 401, code: 'sync-key', fatal: true, message: 'sync key required' };
      ({ res, json } = await postOnce(path, body, timeoutMs, key));
      if (res.status === 401) return { ok: false, status: 401, code: 'sync-key', fatal: true, message: 'sync key not accepted' };
    }
    if (res.ok && json && json.data) return { ok: true, data: json.data };
    if (res.status === 413) return { ok: false, status: 413, code: 'too-large', fatal: true, message: 'recording too large' };
    if (!json || !json.error) {
      // No JSON error from our function: the route is missing (plain `vite dev` has no /api).
      return { ok: false, status: res.status, code: 'no-endpoint', fatal: true,
        message: `The AI endpoint ${path} is not available here (HTTP ${res.status}).` };
    }
    const e = json.error;
    return { ok: false, status: res.status, code: e.code || '', fatal: !!e.fatal, message: e.message || `HTTP ${res.status}` };
  } catch (err) {
    if (err && err.name === 'AbortError') return { ok: false, status: 0, code: 'timeout', timeout: true, message: 'timeout' };
    return { ok: false, status: 0, code: 'network', message: (err && err.message) || 'network error' };
  }
}

// One wording for the setup/permission problems, shared by both features.
export function aiSetupMessage(err) {
  if (!err) return null;
  if (err.code === 'sync-key') return 'This feature needs your sync key (the one the Verb Meister tracker uses). Try again and enter it when asked.';
  if (err.code === 'sync-key-chars') return 'That sync key was not saved. ' + BAD_KEY_NOTE + ' Try again and enter the key exactly as it is set in Vercel.';
  if (err.code === 'not-configured') return 'The AI is not set up on the server yet: ' + (err.message || '') + ' Set it in Vercel → Settings → Environment Variables and redeploy.';
  if (err.code === 'locked') return 'Too many different wrong sync keys were sent from this network, so the AI features are paused for up to 15 minutes. Then try again with the correct key.';
  if (err.code === 'daily-limit') return err.message || 'The daily limit for this feature is reached. It starts again at midnight UTC.';
  if (err.code === 'key-rejected') return 'Gemini rejected the server\'s API key (' + (err.message || 'no detail') + '). Check GEMINI_API_KEY in Vercel and redeploy.';
  if (err.code === 'no-endpoint') return err.message;
  if (err.code === 'too-large') return 'The recording is too large to send. Please record a shorter take.';
  return null;
}
