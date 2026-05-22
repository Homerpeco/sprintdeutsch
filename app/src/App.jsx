import { useState, useMemo } from 'react';
import { SEED_VERBS } from './data/seedVerbs.js';
import { LEVELS } from './data/roadmap.js';
import { initialState, saveState } from './lib/storage.js';
import { Icon } from './components/Icon.jsx';
import { Pill } from './components/Pill.jsx';
import { RoadmapView } from './views/RoadmapView.jsx';
import { LernView } from './views/LernView.jsx';
import { PracticeView } from './views/PracticeView.jsx';
import { WiederholungView } from './views/WiederholungView.jsx';
import { StatsView } from './views/StatsView.jsx';
import { AITutor } from './views/AITutor.jsx';
import { SettingsModal } from './views/SettingsModal.jsx';

// langey-data.js is loaded via <script> in index.html and sets window.LANGEY_DATA.
const LD = (typeof window !== "undefined" && window.LANGEY_DATA) ? window.LANGEY_DATA : {};
const VERBS = (LD.verbs && LD.verbs.length) ? LD.verbs : SEED_VERBS;

export function App() {
  const [state, _setState] = useState(initialState);
  const setState = (s) => { _setState(s); saveState(s); };

  const [view, setView] = useState({ section: "roadmap", tab: null });
  const [tutorOpen, setTutorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [seed, setSeed] = useState({ prompt: "", ragQuery: "" });

  function openTutor(prompt, ragQuery) {
    if (prompt) setSeed({ prompt, ragQuery: ragQuery || "" });
    setTutorOpen(true);
  }

  const dueCount = useMemo(() => {
    const now = Date.now();
    return Object.values(state.srs || {}).filter(s => s && s.due && s.due <= now).length;
  }, [state.srs]);

  const navItems = [
    { id: "roadmap",      label: "Roadmap",      icon: Icon.Roadmap },
    { id: "lern",         label: "Lern",          icon: Icon.Book },
    { id: "practice",     label: "Practice",      icon: Icon.Mic },
    { id: "wiederholung", label: "Wiederholung",  icon: Icon.Sparkle, badge: dueCount },
    { id: "stats",        label: "Stats",         icon: Icon.Stats },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{backgroundColor:'#d4e8c2'}}>
      {/* Header */}
      <header className="sticky top-0 z-30 shadow-md" style={{backgroundColor:'#355f1f'}}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 mr-auto">
            {/* SprintDeutsch lightning-bolt icon */}
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                 style={{backgroundColor:'#f9e96a'}}>
              <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 1L1 11.5H7.5L7 19L15 8.5H8.5L9 1Z"
                      fill="#284a18" stroke="#284a18" strokeWidth="0.5"
                      strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-bold text-lg text-white hidden sm:inline tracking-tight">SprintDeutsch</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {LEVELS.map(l => (
              <Pill key={l} active={state.level === l} onClick={() => setState({ ...state, level: l })}>{l}</Pill>
            ))}
          </div>
          <select
            value={state.level}
            onChange={e => setState({ ...state, level: e.target.value })}
            className="md:hidden bg-forest-600 border border-forest-500 text-white rounded-lg px-3 py-1.5 text-sm font-medium"
          >
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button
            onClick={() => openTutor()}
            className="ml-1 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 transition"
            style={{
              background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
              color: '#ffffff',
              boxShadow: '0 0 12px rgba(168,85,247,0.55), 0 2px 6px rgba(0,0,0,0.25)',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(168,85,247,0.75), 0 2px 8px rgba(0,0,0,0.3)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 12px rgba(168,85,247,0.55), 0 2px 6px rgba(0,0,0,0.25)'}
          >
            <Icon.Sparkle className="w-4 h-4" /> <span className="hidden sm:inline">AI Tutor</span>
          </button>
          <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-lg hover:bg-forest-600 transition" title="Settings">
            <Icon.Cog className="w-5 h-5 text-forest-100" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar (desktop) */}
        <nav className="hidden sm:flex flex-col gap-1 p-4 w-52" style={{backgroundColor:'#355f1f', borderRight:'1px solid #284a18'}}>
          {navItems.map(n => {
            const Icn = n.icon;
            const active = view.section === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setView({ section: n.id, tab: null })}
                style={active ? {backgroundColor:'#427726'} : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                  active
                    ? "text-white shadow-sm"
                    : "text-white/75 hover:bg-white/10"
                }`}
              >
                <Icn className="w-5 h-5" />
                <span className="flex-1 text-left">{n.label}</span>
                {n.badge ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white">{n.badge}</span> : null}
              </button>
            );
          })}
          <div className="mt-auto pt-6 text-xs text-white/60">
            <div className="font-semibold text-white/80 mb-1">Streak</div>
            <div>{state.streak.current} day{state.streak.current === 1 ? "" : "s"} 🔥</div>
          </div>
        </nav>

        {/* Main */}
        <main className="flex-1 min-w-0 pb-20 sm:pb-0" style={{backgroundColor:'#d4e8c2'}}>
          {view.section === "roadmap"      && <RoadmapView      state={state} setView={setView} verbs={VERBS} />}
          {view.section === "lern"         && <LernView         state={state} setState={setState} view={view} setView={setView} openTutor={openTutor} verbs={VERBS} langeyData={LD} />}
          {view.section === "practice"     && <PracticeView     state={state} setState={setState} view={view} setView={setView} openTutor={openTutor} />}
          {view.section === "wiederholung" && <WiederholungView state={state} setState={setState} openTutor={openTutor} />}
          {view.section === "stats"        && <StatsView        state={state} verbs={VERBS} />}
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30" style={{backgroundColor:'#355f1f', borderTop:'1px solid #284a18'}}>
        <div className="flex">
          {navItems.map(n => {
            const Icn = n.icon;
            const active = view.section === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setView({ section: n.id, tab: null })}
                className={`relative flex-1 py-2 flex flex-col items-center gap-0.5 text-[10px] transition ${
                  active ? "text-yellow-300" : "text-white/70"
                }`}
              >
                <Icn className="w-5 h-5" />
                <span className="truncate max-w-[80%]">{n.label}</span>
                {n.badge ? <span className="absolute top-1 right-1/2 translate-x-4 text-[9px] font-bold px-1 py-0.5 rounded-full bg-rose-500 text-white min-w-[16px] text-center">{n.badge}</span> : null}
              </button>
            );
          })}
        </div>
      </nav>

      <AITutor
        state={state}
        setState={setState}
        isOpen={tutorOpen}
        onClose={() => setTutorOpen(false)}
        seed={seed}
        clearSeed={() => setSeed({ prompt: "", ragQuery: "" })}
      />
      <SettingsModal
        state={state}
        setState={setState}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
