// /api/verbs — tiny personal cloud store for the Verb Meister App.
// GET  → returns {verbs, log, updatedAt} from Vercel Blob (empty doc if none yet)
// PUT/POST → saves the document
//
// Requirements (Vercel dashboard):
//   1. Storage → Create → Blob store, connected to this project
//      (adds BLOB_READ_WRITE_TOKEN automatically)
//   2. Optional but recommended: env var VERB_SYNC_SECRET — a PIN/password of your
//      choice. When set, all requests must carry it; the app prompts you once
//      per browser and remembers it.

import { put, list } from '@vercel/blob';

const BLOB_PATH = 'verb-tracker/verbs.json';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const secret = process.env.VERB_SYNC_SECRET;
  if (secret && req.headers['x-sync-key'] !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: 'verb-tracker/' });
      const doc = blobs.find(b => b.pathname === BLOB_PATH);
      if (!doc) return res.status(200).json({ verbs: [], log: {}, updatedAt: null });
      const data = await fetch(doc.url).then(r => r.json());
      return res.status(200).json(data);
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (!Array.isArray(body.verbs)) return res.status(400).json({ error: 'verbs array required' });
      const doc = {
        verbs: body.verbs,
        log: body.log || {},
        updatedAt: body.updatedAt || new Date().toISOString(),
      };
      await put(BLOB_PATH, JSON.stringify(doc), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
      return res.status(200).json({ ok: true, updatedAt: doc.updatedAt });
    }

    res.setHeader('Allow', 'GET, PUT, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    // Most common cause: Blob store not created/connected yet
    return res.status(500).json({ error: 'storage error', detail: String(err && err.message || err) });
  }
}
