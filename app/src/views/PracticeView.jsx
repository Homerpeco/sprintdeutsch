import { useState } from 'react';
import { PASSAGES, WRITING_PROMPTS, SPEAKING_PROMPTS } from '../data/passages.js';
import { bumpStreak } from '../lib/streak.js';
import { Card } from '../components/Card.jsx';
import { Pill } from '../components/Pill.jsx';
import { Icon } from '../components/Icon.jsx';

function SpeakingPractice({ state, setState, openTutor }) {
  const prompt = SPEAKING_PROMPTS[state.level];
  function complete() {
    setState(bumpStreak({ ...state, practice: { ...state.practice, speaking: state.practice.speaking + 1 } }));
  }
  return (
    <Card className="p-6">
      <div className="text-sm font-medium text-indigo-600 mb-2">Speaking · {state.level}</div>
      <p className="text-xl mb-6 font-medium">{prompt}</p>
      <div className="p-4 rounded-xl bg-slate-50 mb-4 text-sm text-slate-600">
        Record yourself answering (in your phone's voice memo or any recorder), then tell the AI tutor your answer in chat for live correction.
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={complete} className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600">Mark complete</button>
        <button
          onClick={() => openTutor(`Please act as my speaking coach. The prompt was: "${prompt}". I'll send you my answer in German next.`)}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 flex items-center gap-2"
        >
          <Icon.Sparkle className="w-4 h-4" /> Ask AI tutor
        </button>
      </div>
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
      {tab === "speaking"  && <SpeakingPractice  state={state} setState={setState} openTutor={openTutor} />}
      {tab === "writing"   && <WritingPractice   state={state} setState={setState} openTutor={openTutor} />}
      {tab === "reading"   && <ReadingPractice   state={state} setState={setState} openTutor={openTutor} />}
      {tab === "listening" && <ListeningPractice state={state} setState={setState} openTutor={openTutor} />}
    </div>
  );
}
