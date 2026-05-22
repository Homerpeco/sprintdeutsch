import { useState, useMemo, useRef, useCallback } from 'react';
import { GRAMMAR } from '../data/grammar.js';
import { GRAMMAR_EXERCISES } from '../data/grammarExercises.js';
import { VERB_MATRIX_SEED } from '../data/verbMatrix.js';
import { srsKey, srsUpdate, dueIn, dueLabel } from '../lib/srs.js';
import { buildLearnPrompt, buildQuizPrompt } from '../lib/prompts.js';
import { bumpStreak } from '../lib/streak.js';
import { Pill } from '../components/Pill.jsx';
import { Card } from '../components/Card.jsx';
import { Icon } from '../components/Icon.jsx';
import { SRSRatingButtons } from '../components/SRSRatingButtons.jsx';

// ─── ExampleWithBoldVerb ─────────────────────────────────────────────────────
function ExampleWithBoldVerb({ sentence, verb }) {
  if (!sentence || !verb) return <>{sentence}</>;
  // Strip common German infinitive endings to get the stem
  const stem = verb
    .replace(/ieren$/, 'ier')
    .replace(/eln$/, 'el')
    .replace(/ern$/, 'er')
    .replace(/en$/, '')
    .replace(/n$/, '');
  if (stem.length < 3) return <>{sentence}</>;
  const stemLower = stem.toLowerCase();
  // Split on whitespace, keeping the whitespace tokens
  const parts = sentence.split(/(\s+)/);
  let bolded = false;
  return (
    <>
      {parts.map((part, i) => {
        const wordOnly = part.replace(/[^a-zA-ZäöüÄÖÜß]/g, '').toLowerCase();
        if (!bolded && wordOnly.length > 0 && wordOnly.startsWith(stemLower)) {
          bolded = true;
          return <strong key={i} className="font-semibold not-italic text-slate-900">{part}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── VocabDrill ───────────────────────────────────────────────────────────────

function VocabDrill({ state, setState, verbs }) {
  const LEVEL_ORDER = ["A1","A2","B1","B2","C1"];

  const deck = useMemo(() => {
    const filtered = verbs.filter(v => v.lvl === state.level);
    return filtered.sort((a, b) => {
      const sa = state.verbsKnown[a.v]?.correct || 0;
      const sb = state.verbsKnown[b.v]?.correct || 0;
      return sa - sb;
    });
  }, [state.level, state.verbsKnown, verbs]);

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = deck[idx % deck.length];
  if (!card) return <div className="text-slate-500">No verbs at this level yet.</div>;

  function mark(known) {
    const cur = state.verbsKnown[card.v] || { seen: 0, correct: 0 };
    const updated = { ...state.verbsKnown, [card.v]: { seen: cur.seen + 1, correct: cur.correct + (known ? 1 : 0) } };
    setState(bumpStreak({ ...state, verbsKnown: updated }));
    setFlipped(false);
    setIdx(i => i + 1);
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE"; u.rate = 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }

  return (
    <div>
      {/* Progress counter */}
      <div className="flex items-center justify-between mb-3 text-sm text-slate-500">
        <span>Card {idx + 1} of {deck.length}</span>
        <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full font-medium">{card.lvl} verb</span>
      </div>

      {/* ── Flip Card ── */}
      <div className="[perspective:1200px] mb-3">
        <div
          className={`card-flip relative bg-white rounded-3xl border border-slate-200 shadow-sm h-[230px] cursor-pointer ${flipped ? "flipped" : ""}`}
          onClick={() => setFlipped(f => !f)}
        >
          {/* FRONT face */}
          <div className="card-face absolute inset-0 p-6 flex flex-col items-center justify-center">
            <div className="text-xs font-medium text-indigo-500 uppercase tracking-widest mb-2">{card.lvl}</div>
            <div className="text-4xl sm:text-5xl font-bold text-slate-900 mb-3">{card.v}</div>
            <button
              onClick={(e) => { e.stopPropagation(); speak(card.v); }}
              className="text-slate-400 hover:text-indigo-500 transition-colors mt-1"
            >
              <Icon.Volume className="w-6 h-6" />
            </button>
            <div className="text-xs text-slate-400 mt-5">Tap card to flip</div>
          </div>

          {/* BACK face */}
          <div className="card-face card-back absolute inset-0 p-5 flex flex-col justify-center">
            {/* Level tag — top right */}
            <div className="absolute top-4 right-4 text-[11px] bg-indigo-50 text-indigo-500 px-2.5 py-0.5 rounded-full font-medium">
              {card.lvl} verb
            </div>

            {/* Verb identity */}
            <div className="mb-5">
              <div className="text-xs text-slate-400 mb-0.5 tracking-wide">{card.en}</div>
              <div className="text-2xl font-bold text-slate-900 leading-tight">{card.v}</div>
            </div>

            {/* Tense matrix — 2-col grid */}
            <div className="grid grid-cols-[60px_1fr] gap-x-4 gap-y-2.5">
              <span className="text-[11px] text-slate-400 uppercase tracking-wide self-center">Pres.</span>
              <span className="text-sm font-semibold text-slate-800">{card.present}</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wide self-center">Prät.</span>
              <span className="text-sm font-semibold text-slate-800">{card.prät}</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wide self-center">Perf.</span>
              <span className="text-sm font-semibold text-slate-800">{card.perf}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Example sentence callout (fades in on flip) ── */}
      <div
        className={`rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-4 mb-3 flex items-start gap-3 transition-all duration-300 ${flipped ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); speak(card.ex); }}
          className="text-indigo-400 hover:text-indigo-600 mt-0.5 flex-shrink-0 transition-colors"
        >
          <Icon.Volume className="w-5 h-5" />
        </button>
        <p className="text-sm text-slate-600 italic leading-relaxed">
          "<ExampleWithBoldVerb sentence={card.ex} verb={card.v} />"
        </p>
      </div>

      {/* ── Action buttons ── */}
      <div className="flex gap-3">
        <button
          onClick={() => mark(false)}
          className="flex-1 py-3 rounded-xl bg-rose-50 text-rose-700 font-medium hover:bg-rose-100 border border-rose-200 transition-colors"
        >
          Didn't know
        </button>
        <button
          onClick={() => mark(true)}
          className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
        >
          I knew it
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-400 text-center">Progress is saved locally on this device.</p>
    </div>
  );
}

// ─── MatrixDrill ──────────────────────────────────────────────────────────────

function _norm(s) { return (s || "").toLowerCase().trim().replace(/\s+/g, " "); }
function _stripReflexive(s) {
  return _norm(s).replace(/\s*\bsich\b\s*/g, " ").replace(/\s+/g, " ").trim();
}
function _normRektion(s) {
  if (!s) return "";
  return s.toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\+/g, "")
    .replace(/[.,]/g, "")
    .replace(/akkusativ/g, "akk")
    .replace(/dativ/g, "dat")
    .replace(/genitiv/g, "gen")
    .replace(/nominativ/g, "nom");
}
function _isNoRektion(s) {
  const n = (s || "").toLowerCase().trim();
  return n === "" || n === "-" || n === "—" || n === "none" || n === "keine" || n === "kein" || n === "–";
}

function checkMatrixAnswer(input, card) {
  const out = {};
  out.inf  = _stripReflexive(input.inf)  === _stripReflexive(card.inf);
  out.prät = _stripReflexive(input.prät) === _stripReflexive(card.prät);
  out.perf = _stripReflexive(input.perf) === _stripReflexive(card.perf);
  const aux = _norm(input.aux);
  out.aux  = (aux === card.aux) || (aux === card.aux[0]);
  if (_isNoRektion(card.rektion)) {
    out.rektion = _isNoRektion(input.rektion);
  } else {
    const expected = _normRektion(card.rektion);
    const alts = (card.rektionAlt || []).map(_normRektion);
    const userN = _normRektion(input.rektion);
    out.rektion = userN === expected || alts.includes(userN);
  }
  out.allCorrect = out.inf && out.prät && out.perf && out.aux && out.rektion;
  return out;
}

function buildMatrixDeck(verbMatrixSrs) {
  const now = Date.now();
  return VERB_MATRIX_SEED
    .map(v => ({ ...v, srs: verbMatrixSrs?.[v.inf] || null }))
    .sort((a, b) => {
      const aOverdue = a.srs && a.srs.due <= now;
      const bOverdue = b.srs && b.srs.due <= now;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      if (aOverdue && bOverdue) return a.srs.due - b.srs.due;
      if (!a.srs && b.srs) return -1;
      if (a.srs && !b.srs) return 1;
      if (a.srs && b.srs) return a.srs.due - b.srs.due;
      return 0;
    });
}

function MatrixField({ label, value, onChange, result, expected, placeholder, autoFocus, inputRef }) {
  const ok = result === true;
  const bad = result === false;
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || ""}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={result !== undefined && result !== null}
        className={`w-full px-3 py-2 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 ${
          ok  ? "bg-emerald-50 border-emerald-300 text-emerald-800 focus:ring-emerald-200" :
          bad ? "bg-rose-50 border-rose-300 text-rose-800 focus:ring-rose-200" :
                "bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-200"
        }`}
      />
      {bad && (
        <div className="text-xs text-rose-600 mt-1 pl-1">
          Erwartet: <span className="font-mono font-medium">{expected || "—"}</span>
        </div>
      )}
    </div>
  );
}

function MatrixDrill({ state, setState }) {
  const deck = useMemo(() => buildMatrixDeck(state.verbMatrixSrs || {}), [state.verbMatrixSrs]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState({ inf: "", prät: "", perf: "", aux: "", rektion: "" });
  const [result, setResult] = useState(null);
  const firstInputRef = useRef(null);

  const card = deck[idx % deck.length];
  if (!card) return <div className="text-slate-500">No verbs available.</div>;

  function reset() {
    setInput({ inf: "", prät: "", perf: "", aux: "", rektion: "" });
    setResult(null);
    setTimeout(() => firstInputRef.current && firstInputRef.current.focus(), 0);
  }

  function check() {
    if (result) return;
    setResult(checkMatrixAnswer(input, card));
  }

  function rate(quality) {
    const k = card.inf;
    const next = srsUpdate(state.verbMatrixSrs?.[k], quality);
    setState({ ...state, verbMatrixSrs: { ...state.verbMatrixSrs, [k]: next } });
    reset();
    setIdx(i => i + 1);
  }

  function reveal() {
    setResult({ inf: false, prät: false, perf: false, aux: false, rektion: false, allCorrect: false, revealed: true });
    setInput({ inf: card.inf, prät: card.prät, perf: card.perf, aux: card.aux, rektion: card.rektion });
  }

  const dueLbl = card.srs ? dueLabel(dueIn(card.srs)) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-sm">
        <span className="text-slate-500">Verb {idx + 1} of {deck.length}</span>
        {card.srs && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${card.srs.due <= Date.now() ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
            {dueLbl} · {card.srs.successCount || 0}✓ {card.srs.failCount || 0}✗
          </span>
        )}
      </div>

      <Card className="p-5 sm:p-6">
        <div className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">English meaning</div>
        <div className="text-2xl sm:text-3xl font-bold mb-5">{card.en}</div>

        <form onSubmit={(e) => { e.preventDefault(); check(); }}>
          <MatrixField label="Infinitive"              inputRef={firstInputRef} autoFocus value={input.inf}     onChange={v => setInput({...input, inf:v})}     result={result?.inf}     expected={card.inf}     placeholder="z. B. sich erinnern" />
          <MatrixField label="Präteritum"              value={input.prät}   onChange={v => setInput({...input, prät:v})}   result={result?.prät}   expected={card.prät}   placeholder="3. Person Sg." />
          <MatrixField label="Partizip II"             value={input.perf}   onChange={v => setInput({...input, perf:v})}   result={result?.perf}   expected={card.perf}   placeholder="ohne Hilfsverb" />
          <MatrixField label="Hilfsverb (haben/sein)"  value={input.aux}    onChange={v => setInput({...input, aux:v})}    result={result?.aux}    expected={card.aux}    placeholder="haben oder sein (auch h / s)" />
          <MatrixField label="Rektion (Präp. + Kasus)" value={input.rektion} onChange={v => setInput({...input, rektion:v})} result={result?.rektion} expected={card.rektion} placeholder='z. B. an + Akkusativ — oder "-" wenn keine' />

          {!result ? (
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700">Check (Enter)</button>
              <button type="button" onClick={reveal} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-sm">Show answer</button>
            </div>
          ) : (
            <div className="mt-2">
              <div className={`p-3 rounded-xl mb-3 text-sm ${result.allCorrect ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                <div className="font-semibold mb-1">
                  {result.allCorrect ? "Alles richtig." : result.revealed ? "Antwort eingeblendet." : "Teilweise richtig — überprüfe die markierten Felder."}
                </div>
                {card.note && <div className="text-xs leading-relaxed opacity-90"><span className="font-medium">Note:</span> {card.note}</div>}
              </div>
              <div className="text-xs text-slate-500 mb-2">Wie ist es gelaufen?</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => rate(1)} className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-sm font-medium">Wieder</button>
                <button type="button" onClick={() => rate(3)} className="px-3 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-sm font-medium">Schwer</button>
                <button type="button" onClick={() => rate(5)} className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-sm font-medium">Gut</button>
              </div>
              <p className="text-[10px] text-slate-400 mt-3">Wieder → fällig morgen. Gut → längeres Intervall (SM-2 mit Leichtigkeitsfaktor).</p>
            </div>
          )}
        </form>
      </Card>

      <p className="mt-4 text-xs text-slate-400 text-center">Tab springt zwischen den Feldern. Enter = Check. „Show answer" reicht ein.</p>
    </div>
  );
}

// ─── TheoryRenderer ──────────────────────────────────────────────────────────
// Classifies each line of the raw theory text and renders it with distinct
// visual treatments: numbered sections, example sentences, word-breakdown
// chips, rule callouts, definition pills, and plain body paragraphs.

function classifyLine(line) {
  const t = line.trim();
  if (!t) return 'empty';

  // Numbered section header  "1. Title text"
  if (/^\d+\.\s+\S/.test(t)) return 'section';

  // Word-by-word breakdown: 4+ "word (translation)" pairs on one line
  const wbCount = (t.match(/[\wäöüÄÖÜß\-]+\s+\([^)]+\)/g) || []).length;
  if (wbCount >= 4) return 'breakdown';

  // Rule / structure callout
  if (/^(The Rule|The Exception|Mechanical Exception|Crucial Rule|Key Rule|Structure|Important Note|Note:|Syntax Rule|Tense Rule|Function [A-Z]:|The Mechanics|The Perfekt|Passive Exception|Die Mechanik|Die Regel)/i.test(t)) return 'rule';

  // Sub-label definition  "term (gloss): explanation"  or  "Term: explanation"
  if (/^[\wäöüÄÖÜß\s\-\/]+(\([^)]*\))?\s*:\s+[^\s]/.test(t) && t.length < 320 && !/^\d/.test(t)) return 'definition';

  // Example sentence: short line that ends with (English translation)
  // Must not be a breakdown or definition already caught above
  if (/\([^)]{4,}\)[.,]?\s*$/.test(t) && t.length < 200) return 'example';

  return 'body';
}

function TheoryRenderer({ text }) {
  if (!text) return null;

  const lines = text.split('\n').filter(l => l.trim());

  return (
    <div className="pb-4">
      {lines.map((raw, i) => {
        const t = raw.trim();
        const type = classifyLine(t);
        if (type === 'empty') return null;

        // ── Numbered section header ──────────────────────────────────────
        if (type === 'section') {
          const m = t.match(/^(\d+)\.\s+(.+)/);
          const num  = m?.[1] ?? '';
          const title = m?.[2] ?? t;
          return (
            <div key={i} className="flex items-center gap-3 mt-7 mb-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                {num}
              </span>
              <h3 className="text-sm font-bold text-indigo-900 leading-snug tracking-wide uppercase">{title}</h3>
            </div>
          );
        }

        // ── Word-by-word breakdown chips ─────────────────────────────────
        if (type === 'breakdown') {
          // Tokenise: "word (gloss)" pairs + bare punctuation
          const tokens = t.split(/(?<=\))\s+/).map(tok => {
            const m = tok.match(/^(.+?)\s+\((.+?)\)([.,]?)$/);
            if (m) return { word: m[1], gloss: m[2], punct: m[3] };
            return { word: tok, gloss: null, punct: '' };
          });
          return (
            <div key={i} className="flex flex-wrap gap-1.5 my-2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl">
              {tokens.map((tok, j) =>
                tok.gloss ? (
                  <span key={j} className="inline-flex flex-col items-center bg-white border border-indigo-100 shadow-sm rounded-lg px-2 py-0.5 text-xs leading-tight">
                    <span className="font-semibold text-slate-800">{tok.word}</span>
                    <span className="text-slate-600 text-[11px] font-medium">{tok.gloss}</span>
                  </span>
                ) : (
                  <span key={j} className="text-slate-400 text-xs self-end pb-0.5">{tok.word}</span>
                )
              )}
            </div>
          );
        }

        // ── Rule / callout box ───────────────────────────────────────────
        if (type === 'rule') {
          const isException = /exception|warning|never|avoid|forbidden|not allowed/i.test(t);
          const isStructure = /^structure:/i.test(t);
          const isCrucial   = /crucial|important/i.test(t);
          let style, icon;
          if (isException) {
            style = 'bg-rose-50 border-rose-400 text-rose-900';
            icon  = '⚠';
          } else if (isStructure) {
            style = 'bg-sky-50 border-sky-400 text-sky-900';
            icon  = '⌘';
          } else if (isCrucial) {
            style = 'bg-amber-50 border-amber-400 text-amber-900';
            icon  = '★';
          } else {
            style = 'bg-emerald-50 border-emerald-500 text-emerald-900';
            icon  = '✓';
          }
          return (
            <div key={i} className={`flex items-start gap-2.5 px-4 py-3 my-2 border-l-4 rounded-r-xl ${style}`}>
              <span className="font-bold text-sm shrink-0 mt-0.5">{icon}</span>
              <p className="text-sm leading-relaxed font-medium">{t}</p>
            </div>
          );
        }

        // ── Definition term ──────────────────────────────────────────────
        if (type === 'definition') {
          const m = t.match(/^(.+?):\s+(.+)/s);
          const term = m?.[1]?.trim() ?? '';
          const body = m?.[2]?.trim() ?? t;
          return (
            <div key={i} className="flex flex-wrap items-baseline gap-2 my-2 pl-1">
              <span className="shrink-0 bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-full leading-none">
                {term}
              </span>
              <span className="text-sm text-slate-700 leading-relaxed">{body}</span>
            </div>
          );
        }

        // ── Example sentence ─────────────────────────────────────────────
        if (type === 'example') {
          // Split "German sentence. (English translation.)"
          const m = t.match(/^(.*?)\s*(\([^)]{4,}\)[.,]?)$/s);
          const german  = m?.[1]?.trim() ?? t;
          const english = m?.[2]?.trim() ?? '';
          return (
            <div key={i} className="flex items-start gap-2.5 my-1.5 px-3 py-2.5 bg-amber-50 border-l-4 border-amber-400 rounded-r-xl">
              <span className="text-amber-500 font-bold text-sm shrink-0 mt-0.5">▸</span>
              <div className="min-w-0">
                <span className="font-semibold text-slate-800 text-sm">{german}</span>
                {english && (
                  <span className="text-slate-500 text-xs ml-2 italic">{english}</span>
                )}
              </div>
            </div>
          );
        }

        // ── Body paragraph ───────────────────────────────────────────────
        return (
          <p key={i} className="text-sm text-slate-700 leading-relaxed my-1.5 pl-1">{t}</p>
        );
      })}
    </div>
  );
}

// ─── GrammarDrill ─────────────────────────────────────────────────────────────

const BATCH_SIZE = 10;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normAnswer(s) {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function checkAnswer(input, ex) {
  const user = normAnswer(input);
  if (!user) return null; // not yet answered
  const main = normAnswer(ex.answer);
  if (user === main) return true;
  if (ex.answerAlt && ex.answerAlt.some(a => normAnswer(a) === user)) return true;
  // Accept first word if answer contains slash (e.g. "wäre / machte")
  const parts = main.split(/\s*\/\s*/);
  if (parts.length > 1 && parts.some(p => normAnswer(p) === user)) return true;
  return false;
}

function GrammarDrill({ state }) {
  const topics = GRAMMAR[state.level] || [];
  const exercisesByLevel = GRAMMAR_EXERCISES[state.level] || {};

  const [selectedTopic, setSelectedTopic] = useState("");
  const [mode, setMode] = useState(null); // 'practice' | 'learn' | 'help' | null
  const [batch, setBatch] = useState([]);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const currentGrammarEntry = topics.find(t => t.topic === selectedTopic);
  const currentExercises = exercisesByLevel[selectedTopic];

  function loadBatch(topic) {
    const topicData = exercisesByLevel[topic];
    if (!topicData || !topicData.exercises || !topicData.exercises.length) return [];
    return shuffle(topicData.exercises).slice(0, BATCH_SIZE);
  }

  function startPractice(topic) {
    const t = topic || selectedTopic;
    const b = loadBatch(t);
    setBatch(b);
    setAnswers({});
    setChecked(false);
    setMode("practice");
  }

  function startLearn() {
    setMode("learn");
    setShowHelp(false);
  }

  function handleTopicChange(e) {
    const val = e.target.value;
    setSelectedTopic(val);
    setMode(null);
    setChecked(false);
    setAnswers({});
    setBatch([]);
  }

  function handleCheck() {
    setChecked(true);
  }

  function handleNext() {
    const b = loadBatch(selectedTopic);
    setBatch(b);
    setAnswers({});
    setChecked(false);
  }

  const allAnswered = batch.length > 0 && batch.every((_, i) => (answers[i] || "").trim() !== "");
  const score = checked ? batch.filter((ex, i) => checkAnswer(answers[i], ex) === true).length : 0;

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Dropdown */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <select
            value={selectedTopic}
            onChange={handleTopicChange}
            className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">Select topic</option>
            {topics.map(t => (
              <option key={t.topic} value={t.topic}>{t.topic}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Action buttons */}
        <button
          onClick={() => selectedTopic && startPractice()}
          disabled={!selectedTopic}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
            selectedTopic && mode === "practice"
              ? "bg-slate-900 text-white"
              : selectedTopic
              ? "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          {mode === "practice" ? "Next" : "Practice"}
        </button>

        <button
          onClick={() => selectedTopic && startLearn()}
          disabled={!selectedTopic}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
            selectedTopic && mode === "learn"
              ? "bg-slate-900 text-white"
              : selectedTopic
              ? "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          Learn
        </button>

        <button
          onClick={() => selectedTopic && setMode("help")}
          disabled={!selectedTopic}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
            selectedTopic && mode === "help"
              ? "bg-amber-200 text-amber-900"
              : selectedTopic
              ? "bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          Help
        </button>
      </div>

      {/* ── Empty state ── */}
      {!selectedTopic && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
          <div className="text-4xl mb-3">📚</div>
          <div className="font-medium mb-1">Select a grammar topic</div>
          <div className="text-sm">Then click <strong>Practice</strong> to fill in the blanks, or <strong>Learn</strong> to read the explanation.</div>
        </div>
      )}

      {/* ── LEARN mode ── */}
      {mode === "learn" && currentGrammarEntry && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100"
               style={{background:"linear-gradient(135deg,#eef2ff 0%,#f0f9ff 100%)"}}>
            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">{state.level} · Grammar</div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">{selectedTopic}</h2>
          </div>

          {/* Body */}
          <div className="px-6 py-4 max-h-[72vh] overflow-y-auto scrollbar-thin">
            {currentExercises?.theory
              ? <TheoryRenderer text={currentExercises.theory} />
              : <p className="text-slate-500 italic text-sm leading-relaxed">{currentGrammarEntry.desc}</p>
            }
          </div>

          {/* Footer CTA — always visible in learn mode */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between"
               style={{backgroundColor:'#f8faf6'}}>
            {currentExercises?.exercises?.length > 0 ? (
              <>
                <span className="text-xs text-slate-400">
                  {currentExercises.exercises.length} practice sentences ready
                </span>
                <button
                  onClick={() => startPractice()}
                  className="px-5 py-2 rounded-xl text-white text-sm font-semibold transition"
                  style={{backgroundColor:'#355f1f'}}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor='#427726'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor='#355f1f'}
                >
                  Practice this topic →
                </button>
              </>
            ) : (
              <>
                <span className="text-xs text-slate-400">No fill-in exercises for this topic yet</span>
                <span className="text-xs text-slate-400 italic">Try the AI Tutor for a custom quiz ✨</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── HELP mode ── */}
      {mode === "help" && currentGrammarEntry && (
        <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="px-6 py-4 border-b border-amber-200"
               style={{background:"linear-gradient(135deg,#fffbeb 0%,#fef9c3 100%)"}}>
            <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Quick Reference</div>
            <h2 className="text-base font-bold text-slate-900">{selectedTopic}</h2>
          </div>

          {/* Body — first section only (overview) */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
            {currentExercises?.theory
              ? (() => {
                  // Show up to the start of section 2 only
                  const lines = currentExercises.theory.split('\n').filter(l => l.trim());
                  const cutoff = lines.findIndex((l, idx) => idx > 0 && /^2\./.test(l.trim()));
                  const preview = cutoff > 0 ? lines.slice(0, cutoff) : lines.slice(0, 18);
                  return (
                    <>
                      <TheoryRenderer text={preview.join('\n')} />
                      {cutoff > 0 && (
                        <button onClick={() => setMode("learn")}
                          className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                          Read full explanation →
                        </button>
                      )}
                    </>
                  );
                })()
              : <p className="text-slate-700 leading-relaxed text-sm">{currentGrammarEntry.desc}</p>
            }
          </div>
        </div>
      )}

      {/* ── PRACTICE mode ── */}
      {mode === "practice" && batch.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Instruction */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Instruction</div>
            <div className="text-sm text-slate-700 font-medium">{currentExercises?.instruction || "Fill in the blank"}</div>
          </div>

          {/* Score banner (after check) */}
          {checked && (
            <div className={`px-6 py-3 text-sm font-semibold border-b ${score === batch.length ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>
              {score === batch.length
                ? `✓ Alles richtig! ${score}/${batch.length}`
                : `${score}/${batch.length} richtig — überprüfe die markierten Felder`}
            </div>
          )}

          {/* Sentences */}
          <div className="divide-y divide-slate-100">
            {batch.map((ex, i) => {
              const status = checked ? checkAnswer(answers[i], ex) : null;
              // Split sentence at ___
              const parts = (ex.sentence || "").split("___");
              return (
                <div key={i} className={`px-6 py-4 flex items-start gap-3 ${checked && status === false ? "bg-rose-50" : checked && status === true ? "bg-emerald-50" : ""}`}>
                  {/* Index */}
                  <span className="text-xs font-bold text-slate-400 mt-3 w-4 shrink-0">{i + 1}</span>

                  {/* Sentence + input */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1 text-sm text-slate-800 leading-relaxed">
                      {parts.map((part, pi) => (
                        <span key={pi} className="flex items-center gap-1 flex-wrap">
                          <span>{part}</span>
                          {pi < parts.length - 1 && (
                            <input
                              type="text"
                              value={answers[i] || ""}
                              onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))}
                              disabled={checked}
                              placeholder="___"
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              className={`inline-block min-w-[120px] max-w-[200px] px-2.5 py-1 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 transition ${
                                !checked
                                  ? "border-slate-300 bg-white focus:border-green-400 focus:ring-green-200"
                                  : status === true
                                  ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                                  : "border-rose-400 bg-rose-50 text-rose-800"
                              }`}
                            />
                          )}
                        </span>
                      ))}
                    </div>
                    {/* English hint */}
                    {ex.hint && (
                      <div className="text-xs text-slate-400 mt-1 italic">{ex.hint}</div>
                    )}
                    {/* Correct answer shown on wrong */}
                    {checked && status === false && (
                      <div className="text-xs text-rose-700 mt-1 font-medium">
                        ✗ Correct: <span className="font-mono">{ex.answer}</span>
                      </div>
                    )}
                  </div>

                  {/* Translate icon (shows answer hint on demand) */}
                  <button
                    title="Show answer"
                    onClick={() => setAnswers(a => ({ ...a, [i]: ex.answer }))}
                    className="shrink-0 mt-2 p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer buttons */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-3 items-center">
            {!checked ? (
              <button
                onClick={handleCheck}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800"
              >
                Check answers
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800"
              >
                Next batch →
              </button>
            )}
            <span className="text-xs text-slate-400">
              {batch.length} sentences · click the <strong>🔤</strong> icon to reveal an answer
            </span>
          </div>
        </div>
      )}

      {/* No exercises for selected topic */}
      {mode === "practice" && selectedTopic && (!currentExercises?.exercises?.length) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <div className="text-3xl mb-3">📝</div>
          <div className="font-semibold text-slate-700 mb-1">No fill-in exercises yet for</div>
          <div className="font-bold text-slate-900 mb-3">"{selectedTopic}"</div>
          <p className="text-sm text-slate-500 mb-4">
            Try <strong>Learn</strong> to read the full explanation, or ask the <strong>AI Tutor</strong> to create a custom quiz for this topic.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setMode("learn")}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition"
              style={{backgroundColor:'#355f1f'}}
            >
              Read explanation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LernView (tab router) ────────────────────────────────────────────────────

export function LernView({ state, setState, view, setView, openTutor, verbs, langeyData }) {
  const tab = view.tab || "vocab";
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto fade-in">
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Pill variant="light" active={tab === "vocab"}   onClick={() => setView({ ...view, tab: "vocab" })}>Vocabulary</Pill>
        <Pill variant="light" active={tab === "matrix"}  onClick={() => setView({ ...view, tab: "matrix" })}>Verb Matrix</Pill>
        <Pill variant="light" active={tab === "grammar"} onClick={() => setView({ ...view, tab: "grammar" })}>Grammar</Pill>
      </div>
      {tab === "vocab"   && <VocabDrill   state={state} setState={setState} verbs={verbs} />}
      {tab === "matrix"  && <MatrixDrill  state={state} setState={setState} />}
      {tab === "grammar" && <GrammarDrill state={state} setState={setState} openTutor={openTutor} />}
    </div>
  );
}
