// POST /api/verb-scan — the Verb Scanner's AI lookup, run on the server so that no
// Gemini key is ever shipped to the browser (see _gemini.js).
// Headers: x-sync-key (same key as /api/verbs). Body: {"verb": "trinken", "m": 0}
//   m = which model to try (0 = first choice, 1 = fallback); the browser retries.
// 200 {"data": {...}} or {"error": {code, message, fatal}} with 400/401/429/502/503/504.
// Limits (key length, guess lock, daily ceiling): see _guard.js.
// The prompt is built here, from a cleaned verb only, so the endpoint cannot be used
// as a general-purpose Gemini relay.
import { guard, readBody, generateJson, withinDailyLimit } from './_gemini.js';

export const maxDuration = 60;

// Current -latest aliases (Gemini 3.x). No thinkingConfig: 3.x rejects thinkingBudget:0.
const MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest'];

const GENERATION_CONFIG = {
  temperature: 0.2,
  // No thinkingConfig: Gemini 3.x models reject thinkingBudget:0 (400). We let
  // the model think and just skip the "thought" part when parsing the JSON.
  responseMimeType: "application/json",
  responseSchema: {
    type: "OBJECT",
    properties: {
      success: {type: "BOOLEAN"},
      infinitive: {type: "STRING"},
      praesens: {type: "STRING"},
      praeteritum: {type: "STRING"},
      perfekt: {type: "STRING"},
      pattern: {type: "STRING"},
      reihe: {type: "INTEGER"},
      meaning: {type: "STRING"},
      synonyms: {type: "ARRAY", items: {type: "OBJECT", properties: {de: {type: "STRING"}, en: {type: "STRING"}}, propertyOrdering: ["de","en"]}},
      antonyms: {type: "ARRAY", items: {type: "OBJECT", properties: {de: {type: "STRING"}, en: {type: "STRING"}}, propertyOrdering: ["de","en"]}},
      msg: {type: "STRING"}
    },
    propertyOrdering: ["success","infinitive","praesens","praeteritum","perfekt","pattern","reihe","meaning","synonyms","antonyms","msg"]
  }
};

function cleanVerb(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[^\p{L} \-'()/.,]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function buildPrompt(verb) {
  return `You are a precise German morphology expert. Analyze the verb: "${verb}".

Step 1 — Give the 3rd person singular (er/sie/es) for Präsens, Präteritum and Perfekt, with the correct auxiliary (haben/sein).
Step 2 — Determine the Ablautreihe STRICTLY from the three STEM VOWELS, in this exact order: [infinitive stem vowel] - [Präteritum stem vowel] - [Partizip II stem vowel]. Read each stem vowel directly off the principal parts you just produced (ignore prefixes such as ge-, be-, ver-, ent-, and any separable prefix).
Step 3 — Match those three vowels to EXACTLY one of these 10 patterns:
1: ei-ie-ie, 2: ei-i-i, 3: ie-o-o, 4: i-a-u, 5: e-a-o, 6: e-a-e, 7: a-u-a, 8: a-ie-a, 9: e-a-a, 10: i-a-o.

CRITICAL RULE: the "pattern" you output MUST equal the three stem vowels you actually extracted — never approximate or guess by analogy to another verb.

CRITICAL RULE (i-a-u vs i-a-o): both exist and they are DIFFERENT Reihen. Look at the Partizip II vowel and nothing else.
- Partizip II vowel = u → "i-a-u" → Reihe 4 (binden/band/gebunden, singen/sang/gesungen, trinken/trank/getrunken, finden, springen, zwingen, klingen, sinken, gelingen).
- Partizip II vowel = o → "i-a-o" → Reihe 10 (beginnen/begann/begonnen, gewinnen/gewann/gewonnen, schwimmen/schwamm/geschwommen, spinnen/spann/gesponnen, sinnen/sann/gesonnen, rinnen/rann/geronnen, and their prefixed forms gerinnen, zerrinnen, entrinnen, besinnen, ersinnen).
Rule of thumb: stems ending in a DOUBLE nasal (-nn-, -mm-) take o (Reihe 10); stems ending in -nd, -ng, -nk take u (Reihe 4).

Worked examples:
- stehen → stem vowels of stehen / stand / gestanden = e, a, a → pattern "e-a-a" → Reihe 9. (It is NOT a-u-a.)
- fahren → fahren / fuhr / gefahren = a, u, a → "a-u-a" → Reihe 7.
- nehmen → nehmen / nahm / genommen = e, a, o → "e-a-o" → Reihe 5.
- beginnen → beginnen / begann / begonnen = i, a, o → "i-a-o" → Reihe 10. (It is NOT i-a-u — the participle is begONNen, not "begunnen".)
- gewinnen → gewinnen / gewann / gewonnen = i, a, o → "i-a-o" → Reihe 10.
- singen → singen / sang / gesungen = i, a, u → "i-a-u" → Reihe 4.

If the verb does NOT fit any of the 10 patterns (e.g. gehen, sein, tun, or a regular/weak verb), output success:false, reihe:0, pattern:"Unknown".
In "msg" (short, English), state the three stem vowels you used and confirm they match the pattern.

ALWAYS also provide (regardless of the pattern), to help the learner build a semantic web:
- "meaning": the primary English meaning of the verb, concise.
- "synonyms": exactly 3 common German synonyms, each as an object {de, en} where en is a short English gloss.
- "antonyms": exactly 3 German antonyms (opposites), each as {de, en}. If fewer true opposites exist, give the closest contrasting verbs.`;
}

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  const body = readBody(req);
  const verb = cleanVerb(body.verb);
  if (!verb) {
    return res.status(400).json({ error: { code: 'bad-request', message: 'Enter a German verb.', fatal: true } });
  }
  if (!withinDailyLimit(res, 'verb-scan')) return;
  const model = MODELS[Number(body.m) === 1 ? 1 : 0];
  const out = await generateJson({
    model, parts: [{ text: buildPrompt(verb) }], generationConfig: GENERATION_CONFIG, timeoutMs: 28000,
  });
  res.setHeader('X-Ai-Model', model);
  return res.status(out.status).json(out.body);
}
