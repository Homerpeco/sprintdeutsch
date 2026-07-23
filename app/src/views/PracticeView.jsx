import { useState, useRef, useEffect } from 'react';
import { PASSAGES, WRITING_PROMPTS, SPEAKING_PROMPTS } from '../data/passages.js';
import { bumpStreak } from '../lib/streak.js';
import { Card } from '../components/Card.jsx';
import { Pill } from '../components/Pill.jsx';
import { Icon } from '../components/Icon.jsx';

// ---- Pronunciation target sentences per level (tricky German sounds: ö ü ä, ich/ach-Laut, r, z, sp/st, sch) ----
const PRONUNCIATION_SENTENCES = {
  A1: [
    "Guten Morgen! Ich möchte einen Kaffee und ein Brötchen, bitte.",
    "Meine Schwester wohnt in einer schönen Stadt am Fluss.",
    "Am Sonntag spiele ich mit meinen Kindern im Garten.",
  ],
  A2: [
    "Am Wochenende fahre ich mit dem Fahrrad zum See und treffe meine Freunde.",
    "Können Sie mir bitte erklären, wie ich zum Bahnhof komme?",
    "Im Frühling blühen die Bäume und die Vögel singen früh am Morgen.",
  ],
  B1: [
    "Obwohl das Wetter schlecht war, haben wir einen schönen Ausflug gemacht.",
    "Ich würde mich freuen, wenn wir uns nächste Woche treffen könnten.",
    "Die Straßenbahn quietschte, während sie um die enge Ecke fuhr.",
  ],
  B2: [
    "Die Wissenschaftlerin erklärte die Zusammenhänge zwischen Umwelt und Wirtschaft.",
    "Trotz zahlreicher Schwierigkeiten verfolgte das Team seine ehrgeizigen Ziele.",
    "Zwischen den Zeilen verbirgt sich häufig die eigentliche Aussage des Textes.",
  ],
  C1: [
    "Trotz zahlreicher Rückschläge verfolgte er beharrlich seine ursprünglichen Ziele.",
    "Die gesellschaftlichen Auswirkungen der Digitalisierung sind kaum zu überschätzen.",
    "Ihre außergewöhnliche Ausdrucksweise zeugte von jahrelanger, gründlicher Übung.",
  ],
};

// ---- Suggested presentation topics for free speaking (5–10 sentences), per level ----
const PRESENTATION_TOPICS = {
  A1: ["Meine Familie", "Mein Tagesablauf", "Meine Hobbys", "Meine Heimatstadt", "Mein Lieblingsessen"],
  A2: ["Mein letztes Wochenende", "Mein letzter Urlaub", "Mein Traumberuf", "Meine beste Freundin / mein bester Freund", "Meine Pläne für nächste Woche"],
  B1: ["Vor- und Nachteile des Landlebens", "Warum Sport wichtig ist", "Eine Reise, die ich nie vergessen werde", "Warum ich Deutsch lerne", "Mein Lieblingsfilm und warum"],
  B2: ["Die Auswirkungen sozialer Medien", "Homeoffice: Chancen und Risiken", "Klimaschutz im Alltag", "Die Rolle der Technik in der Bildung", "Ein Buch, das mich geprägt hat"],
  C1: ["Ethische Fragen der künstlichen Intelligenz", "Work-Life-Balance in der modernen Gesellschaft", "Die Zukunft erneuerbarer Energien", "Kulturelle Identität in einer globalisierten Welt", "Der Wert kultureller Bildung"],
};

// ---- Encode a decoded AudioBuffer to a compact 16 kHz mono 16-bit WAV Blob ----
// (WAV is universally accepted by Gemini; browsers' native MediaRecorder output —
//  webm/ogg/mp4 — is not consistently supported, so we always re-encode to WAV.)
function audioBufferToWav(buffer) {
  const targetRate = 16000;
  const numCh = buffer.numberOfChannels;
  // mix down to mono
  let mono;
  if (numCh > 1) {
    mono = new Float32Array(buffer.length);
    for (let c = 0; c < numCh; c++) {
      const ch = buffer.getChannelData(c);
      for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / numCh;
    }
  } else {
    mono = buffer.getChannelData(0);
  }
  // linear resample to 16 kHz
  const ratio = buffer.sampleRate / targetRate;
  const outLen = Math.max(1, Math.floor(mono.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, mono.length - 1);
    const frac = idx - i0;
    out[i] = mono[i0] * (1 - frac) + mono[i1] * frac;
  }
  const bytesPerSample = 2;
  const dataLen = out.length * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataLen);
  const view = new DataView(ab);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataLen, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * bytesPerSample, true); view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true); writeStr(36, 'data'); view.setUint32(40, dataLen, true);
  let off = 44;
  for (let i = 0; i < out.length; i++) {
    const s = Math.max(-1, Math.min(1, out[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function ScoreBar({ label, value, color }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-bold text-slate-900">{v}</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color }} />
      </div>
    </div>
  );
}

function SpeakingPractice({ state, setState }) {
  const [mode, setMode] = useState('free'); // 'free' = open topic (presentation), 'read' = fixed sentence
  const sentences = PRONUNCIATION_SENTENCES[state.level] || PRONUNCIATION_SENTENCES.B1;
  const topics = PRESENTATION_TOPICS[state.level] || PRESENTATION_TOPICS.B1;
  const [idx, setIdx] = useState(0);
  const [topicIdx, setTopicIdx] = useState(0);
  const [topic, setTopic] = useState('');
  const sentence = sentences[idx % sentences.length];

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [wavBlob, setWavBlob] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  // Free/presentation mode needs room for 5–10 sentences; read mode is short.
  const MAX_SECONDS = mode === 'free' ? 150 : 30;

  useEffect(() => () => {
    // cleanup on unmount: stop mic + release object URL
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  function resetTake() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null); setWavBlob(null); setResult(null); setErrorMsg(null); setSeconds(0);
  }

  function pickSentence(delta) {
    resetTake();
    setIdx(i => (i + delta + sentences.length) % sentences.length);
  }

  async function startRecording() {
    resetTake();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMsg("Your browser doesn't support in-page recording. Please use a recent Chrome, Safari, Firefox or Edge.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        try {
          const raw = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
          const AC = window.AudioContext || window.webkitAudioContext;
          const ctx = new AC();
          const decoded = await ctx.decodeAudioData(await raw.arrayBuffer());
          ctx.close();
          const wav = audioBufferToWav(decoded);
          setWavBlob(wav);
          setAudioUrl(URL.createObjectURL(wav));
        } catch (err) {
          setErrorMsg("Couldn't process the recording. Please try again.");
        }
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s + 1 >= MAX_SECONDS) { stopRecording(); return MAX_SECONDS; }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      setErrorMsg(err && err.name === 'NotAllowedError'
        ? "Microphone access was blocked. Allow mic access in your browser and try again."
        : "Couldn't start the microphone. Check that a mic is connected and permitted.");
    }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setRecording(false);
  }

  async function assess() {
    if (!wavBlob) return;
    setAnalyzing(true); setErrorMsg(null); setResult(null);
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setAnalyzing(false);
      setErrorMsg("No API key configured. Add VITE_GEMINI_API_KEY in Vercel's Environment Variables and redeploy.");
      return;
    }
    let b64;
    try {
      b64 = await blobToBase64(wavBlob);
    } catch (e) {
      setAnalyzing(false);
      setErrorMsg('Could not read the recording. Please record again.');
      return;
    }
    const task = mode === 'read'
      ? `The learner was asked to READ this sentence aloud:\n\n"${sentence}"\n\nCompare what they said to this exact target.`
      : `The learner is practicing a spoken PRESENTATION (about 5–10 sentences of free, spontaneous German)${topic.trim() ? ` on the topic: "${topic.trim()}"` : ' on an open topic of their choice'}. There is no target text — assess the connected speech as delivered.`;
    const prompt = `You are a strict but encouraging German pronunciation coach for a CEFR ${state.level} learner. ${task}

Listen to the attached audio and assess ONLY pronunciation and delivery — NOT grammar, vocabulary or content. Judge three things:
- "pronunciation": accuracy of individual sounds/phonemes across the whole recording (Umlaute ö/ü/ä, the ich- vs ach-Laut, r, z/tz, sch, sp/st, long vs short vowels, word endings).
- "intonation": sentence melody, word/sentence stress and rhythm (Satzmelodie und Betonung), and — for a presentation — natural phrasing and pacing.
- "accent": how close to a native German speaker overall (naturalness and fluency; note excessive hesitation or filler sounds like "ähm").

Score each 0–100 and give an "overall" 0–100. In "transcript", write out what you actually heard (the full speech, not a fixed sentence). In "issues", list up to 5 specific words or sounds that need work, each with a short, concrete English tip on how to produce it. Keep "strengths" and "summary" short and in English. Be honest but motivating, and tailor advice to someone preparing to give presentations.`;
    const requestBody = {
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'audio/wav', data: b64 } }] }],
      generationConfig: {
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
      },
    };

    // Robust delivery: try several models, each with a couple of retries and
    // backoff, so a transient "model overloaded" (503) or rate spike (429) is
    // retried automatically — and falls back to another model — instead of
    // failing the whole assessment.
    // Current -latest aliases (Gemini 3.x): available to new keys and audio-capable.
    // Pinned 2.5 models 404 ("no longer available to new users") on newer projects.
    const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let lastErr = null;

    try {
      let data = null;
      for (let m = 0; m < MODELS.length && !data; m++) {
        for (let attempt = 0; attempt < 2 && !data; attempt++) {
          const controller = new AbortController();
          const to = setTimeout(() => controller.abort(), 45000);
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS[m]}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify(requestBody),
            });
            clearTimeout(to);
            if (res.ok) {
              const j = await res.json();
              const cands = j.candidates || [];
              if (!cands.length) throw Object.assign(new Error('empty'), { retryable: true });
              const parts = (cands[0].content && cands[0].content.parts) || [];
              const text = (parts.find(p => p.text && !p.thought) || {}).text;
              if (!text) throw Object.assign(new Error('empty'), { retryable: true });
              data = JSON.parse(text);
              break;
            }
            let detail = `HTTP ${res.status}`;
            try { const e = await res.json(); detail = e?.error?.message || detail; } catch (_) {}
            const err = new Error(detail);
            err.status = res.status;
            if (res.status === 400 || res.status === 403) throw err; // bad key/request → don't retry
            err.retryable = true; // 429 / 500 / 503 → retry & fall back
            lastErr = err;
          } catch (err) {
            clearTimeout(to);
            if (err.status === 400 || err.status === 403) throw err;
            lastErr = err.name === 'AbortError'
              ? Object.assign(new Error('timeout'), { timeout: true })
              : err;
          }
          if (!data && attempt === 0) await sleep(1200 + Math.random() * 800); // backoff before retrying same model
        }
        if (!data && m < MODELS.length - 1) await sleep(600); // brief pause before next model
      }

      if (!data) throw (lastErr || new Error('unavailable'));

      setResult(data);
      setState(bumpStreak({ ...state, practice: { ...state.practice, speaking: state.practice.speaking + 1 } }));
    } catch (err) {
      let msg;
      if (err.timeout) msg = 'The assessment kept timing out — please try again.';
      else if (err.status === 400 && /api[_ ]?key/i.test(err.message || '')) msg = 'Invalid API key. Check VITE_GEMINI_API_KEY in Vercel and redeploy.';
      else if (err.status === 429) msg = 'Usage limit reached on your Gemini key — please wait a bit and try again.';
      else if (err.status === 503 || /overload|high demand|unavailable/i.test(err.message || '')) msg = 'The AI servers were briefly busy. Please tap "Assess" once more.';
      // Anything unexpected: show the real reason so it can be diagnosed, not hidden.
      else msg = 'Could not assess the recording: ' + (err.message || 'unknown error') + (err.status ? ` (status ${err.status})` : '');
      setErrorMsg(msg);
    } finally {
      setAnalyzing(false);
    }
  }

  const overall = result ? Math.max(0, Math.min(100, Number(result.overall) || 0)) : 0;
  const ring = overall >= 80 ? '#22c55e' : overall >= 55 ? '#f59e0b' : '#f43f5e';

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-sm font-medium text-indigo-600">Speaking · Pronunciation · {state.level}</div>
        {/* Mode toggle */}
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
          <button
            onClick={() => { if (mode !== 'free') { setMode('free'); resetTake(); } }}
            className={`px-3 py-1.5 rounded-md transition ${mode === 'free' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
          >🎤 Free topic</button>
          <button
            onClick={() => { if (mode !== 'read') { setMode('read'); resetTake(); } }}
            className={`px-3 py-1.5 rounded-md transition ${mode === 'read' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
          >📖 Read a sentence</button>
        </div>
      </div>

      {mode === 'free' ? (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="text-[11px] uppercase tracking-wide font-bold text-slate-400">Speak freely — 5 to 10 sentences (up to 2.5 min)</div>
            <button
              onClick={() => { const n = (topicIdx + 1) % topics.length; setTopicIdx(n); setTopic(topics[n]); }}
              className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 text-xs hover:bg-slate-50"
            >💡 Suggest a topic</button>
          </div>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Type your own topic, or tap “Suggest a topic” — e.g. Meine Heimatstadt, Klimaschutz im Alltag…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[15px] focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
          />
          <p className="text-xs text-slate-400 mt-2">
            Optional — leave it blank to talk about anything. Great for rehearsing presentations: speak naturally, then get pronunciation feedback on your whole delivery.
          </p>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-4">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <div className="text-[11px] uppercase tracking-wide font-bold text-slate-400">Read this aloud</div>
            <div className="flex gap-2">
              <button onClick={() => pickSentence(-1)} className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 text-xs hover:bg-slate-50">‹ Prev</button>
              <button onClick={() => pickSentence(1)} className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 text-xs hover:bg-slate-50">New sentence ›</button>
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-semibold text-slate-900 leading-snug">{sentence}</p>
        </div>
      )}

      <p className="text-sm text-slate-500 mb-4">
        🎙️ Record yourself right here — your voice stays in this browser and is used only to assess your pronunciation, tone and accent. Nothing is stored.
      </p>

      {/* Recorder controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {!recording ? (
          <button onClick={startRecording} disabled={analyzing}
            className="px-5 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 flex items-center gap-2 disabled:opacity-50">
            <Icon.Mic className="w-5 h-5" /> {audioUrl ? 'Record again' : 'Start recording'}
          </button>
        ) : (
          <button onClick={stopRecording}
            className="px-5 py-3 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-rose-400 animate-pulse" /> Stop ({MAX_SECONDS - seconds}s)
          </button>
        )}
        {recording && (
          <span className="flex items-center gap-2 text-rose-600 font-medium text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" /> Recording… {seconds}s
          </span>
        )}
      </div>

      {/* Playback + assess */}
      {audioUrl && !recording && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <audio src={audioUrl} controls className="h-10 max-w-full" />
          <button onClick={assess} disabled={analyzing}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50">
            <Icon.Sparkle className="w-4 h-4" /> {analyzing ? 'Assessing…' : 'Assess my pronunciation'}
          </button>
        </div>
      )}

      {analyzing && (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
          <p className="mt-3 text-slate-500 font-medium">Listening to your pronunciation…</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">{errorMsg}</div>
      )}

      {/* Result */}
      {result && !analyzing && (
        <div className="mt-2">
          <div className="flex items-center gap-5 mb-5">
            <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
              <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke={ring} strokeWidth="3.5" strokeLinecap="round"
                  strokeDasharray={`${(overall / 100) * 97.4} 97.4`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-slate-900">{overall}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400">overall</span>
              </div>
            </div>
            <div className="flex-1 min-w-[180px]">
              <ScoreBar label="Pronunciation (sounds)" value={result.pronunciation} color="#6366f1" />
              <ScoreBar label="Intonation / tone" value={result.intonation} color="#8b5cf6" />
              <ScoreBar label="Accent (native-like)" value={result.accent} color="#0ea5e9" />
            </div>
          </div>

          {result.transcript && (
            <div className="mb-4 text-sm">
              <span className="text-[11px] uppercase tracking-wide font-bold text-slate-400">What I heard</span>
              <p className="italic text-slate-700 mt-1">"{result.transcript}"</p>
            </div>
          )}

          {result.strengths && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm mb-3">
              <strong>Strengths:</strong> {result.strengths}
            </div>
          )}

          {Array.isArray(result.issues) && result.issues.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] uppercase tracking-wide font-bold text-slate-400 mb-2">Sounds to work on</div>
              <ul className="space-y-2">
                {result.issues.map((it, i) => (
                  <li key={i} className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                    <span className="font-bold text-amber-900">{it.sound}</span>
                    <span className="text-amber-800"> — {it.tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.summary && <p className="text-sm text-slate-600 mb-4">{result.summary}</p>}

          <button onClick={startRecording}
            className="px-4 py-2.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 flex items-center gap-2">
            <Icon.Mic className="w-4 h-4" /> Try this sentence again
          </button>
        </div>
      )}
    </Card>
  );
}

function WritingPractice({ state, setState, openTutor }) {
  const prompt = WRITING_PROMPTS[state.level];
  const [text, setText] = useState("");
  function submit() {
    if (!text.trim()) return;
    setState(bumpStreak({ ...state, practice: { ...state.practice, writing: state.practice.writing + 1 } }));
    openTutor(`Please correct my German writing and explain any errors. Prompt: "${prompt}"\n\nMy answer:\n${text}`);
  }
  return (
    <Card className="p-6">
      <div className="text-sm font-medium text-indigo-600 mb-2">Writing · {state.level}</div>
      <p className="text-xl mb-4 font-medium">{prompt}</p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={7}
        placeholder="Schreibe hier auf Deutsch…"
        className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
      <div className="flex justify-between items-center mt-3">
        <span className="text-xs text-slate-400">{text.split(/\s+/).filter(Boolean).length} words</span>
        <button onClick={submit} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 flex items-center gap-2">
          <Icon.Sparkle className="w-4 h-4" /> Get feedback
        </button>
      </div>
    </Card>
  );
}

function ReadingPractice({ state, setState, openTutor }) {
  const passage = (PASSAGES[state.level] || PASSAGES.B1)[0];
  const [answered, setAnswered] = useState(false);
  function done() {
    setAnswered(true);
    setState(bumpStreak({ ...state, practice: { ...state.practice, reading: state.practice.reading + 1 } }));
  }
  return (
    <Card className="p-6">
      <div className="text-sm font-medium text-indigo-600 mb-2">Reading · {state.level}</div>
      <h3 className="text-xl font-semibold mb-3">{passage.title}</h3>
      <p className="text-slate-700 leading-relaxed mb-5 whitespace-pre-line">{passage.text}</p>
      <div className="p-4 rounded-xl bg-slate-50 mb-4">
        <div className="text-xs font-medium text-slate-500 mb-1">Question</div>
        <div className="font-medium">{passage.q}</div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={done} className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600">{answered ? "Done ✓" : "Mark read"}</button>
        <button
          onClick={() => openTutor(`Help me understand this passage. I want a translation, then key vocabulary and any grammar I should notice:\n\n"${passage.text}"`)}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 flex items-center gap-2"
        >
          <Icon.Sparkle className="w-4 h-4" /> Explain with AI
        </button>
      </div>
    </Card>
  );
}

function ListeningPractice({ state, setState, openTutor }) {
  const passage = (PASSAGES[state.level] || PASSAGES.B1)[0];
  const [revealed, setRevealed] = useState(false);
  function play() {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(passage.text);
    u.lang = "de-DE"; u.rate = 0.85;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }
  function done() {
    setState(bumpStreak({ ...state, practice: { ...state.practice, listening: state.practice.listening + 1 } }));
  }
  return (
    <Card className="p-6">
      <div className="text-sm font-medium text-indigo-600 mb-2">Listening · {state.level}</div>
      <h3 className="text-xl font-semibold mb-3">{passage.title}</h3>
      <button onClick={play} className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 flex items-center gap-2 mb-5">
        <Icon.Volume className="w-5 h-5" /> Play passage
      </button>
      <div className="p-4 rounded-xl bg-slate-50 mb-3">
        <div className="text-xs font-medium text-slate-500 mb-1">Question</div>
        <div className="font-medium">{passage.q}</div>
      </div>
      <button onClick={() => setRevealed(r => !r)} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
        {revealed ? "Hide transcript" : "Show transcript"}
      </button>
      {revealed && <p className="mt-3 p-4 rounded-xl bg-white border border-slate-200 text-slate-700 leading-relaxed">{passage.text}</p>}
      <div className="flex flex-wrap gap-3 mt-5">
        <button onClick={done} className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600">Mark complete</button>
        <button
          onClick={() => openTutor(`Help me practice listening at ${state.level}. Suggest 3 short German audio resources I can use today and what to listen for.`)}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 flex items-center gap-2"
        >
          <Icon.Sparkle className="w-4 h-4" /> Ask AI for tips
        </button>
      </div>
      <p className="mt-4 text-xs text-slate-400">Uses your browser's built-in German voice. Quality varies by device.</p>
    </Card>
  );
}

export function PracticeView({ state, setState, view, setView, openTutor }) {
  const tab = view.tab || "speaking";
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto fade-in">
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {["speaking","writing","reading","listening"].map(s => (
          <Pill variant="light" key={s} active={tab === s} onClick={() => setView({ ...view, tab: s })}>
            {s[0].toUpperCase() + s.slice(1)}
          </Pill>
        ))}
      </div>
      {tab === "speaking"  && <SpeakingPractice  state={state} setState={setState} />}
      {tab === "writing"   && <WritingPractice   state={state} setState={setState} openTutor={openTutor} />}
      {tab === "reading"   && <ReadingPractice   state={state} setState={setState} openTutor={openTutor} />}
      {tab === "listening" && <ListeningPractice state={state} setState={setState} openTutor={openTutor} />}
    </div>
  );
}
