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

function getSyncKey() {
  try { return localStorage.getItem(SYNC_KEY_KEY) || ''; } catch (e) { return ''; }
}

function askSyncKey(hadOne) {
  let k = null;
  try {
    k = window.prompt((hadOne ? 'The saved sync key was not accepted.\n' : 'The AI features are protected by your sync key.\n')
      + 'Enter your sync key (the VERB_SYNC_SECRET you set in Vercel):');
  } catch (e) { /* dialogs blocked */ }
  k = (k || '').trim();
  if (k) { try { localStorage.setItem(SYNC_KEY_KEY, k); } catch (e) { /* private mode */ } }
  return k;
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
    let key = getSyncKey();
    let { res, json } = await postOnce(path, body, timeoutMs, key);
    if (res.status === 401) {
      key = askSyncKey(!!key);
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
  if (err.code === 'not-configured') return 'The AI is not set up on the server yet: ' + (err.message || '') + ' Add it in Vercel → Settings → Environment Variables and redeploy.';
  if (err.code === 'key-rejected') return 'Gemini rejected the server\'s API key (' + (err.message || 'no detail') + '). Check GEMINI_API_KEY in Vercel and redeploy.';
  if (err.code === 'no-endpoint') return err.message;
  if (err.code === 'too-large') return 'The recording is too large to send. Please record a shorter take.';
  return null;
}
