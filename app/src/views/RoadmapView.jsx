import { GRAMMAR } from '../data/grammar.js';
import { ROADMAP, LEVELS } from '../data/roadmap.js';
import { Card } from '../components/Card.jsx';
import { Pill } from '../components/Pill.jsx';
import { Progress } from '../components/Progress.jsx';

// Hardcoded colours so they always render regardless of Tailwind custom-colour loading
const C = {
  forestDark:   '#284a18',
  forest:       '#355f1f',
  forestMid:    '#427726',
  forestLight:  '#529530',
  cream:        '#f9e96a',
  sageBorder:   '#b8d99e',
  pastBg:       '#e8f3de',
};

// ─── RoadmapView (tab router) ────────────────────────────────────────────────
// Tab "roadmap" (default) = the level path. Tab "nomen" = the Genus-Trainer,
// a self-contained page served from public/genus-trainer.html (same pattern as
// the Verb Meister App). Update it by replacing that file.

export function RoadmapView({ state, setState, view, setView, verbs }) {
  const tab = (view && view.tab) || "roadmap";

  return (
    <div className="fade-in">
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 max-w-4xl mx-auto flex flex-wrap items-center gap-2">
        <Pill variant="light" active={tab === "roadmap"} onClick={() => setView({ section: "roadmap", tab: "roadmap" })}>Roadmap</Pill>
        <Pill variant="light" active={tab === "nomen"}   onClick={() => setView({ section: "roadmap", tab: "nomen" })}>Nomen und Artikel</Pill>
        <Pill variant="light" active={tab === "relativ"} onClick={() => setView({ section: "roadmap", tab: "relativ" })}>Relativsätze</Pill>
        <Pill variant="light" active={tab === "lokal"}   onClick={() => setView({ section: "roadmap", tab: "lokal" })}>Lokalangaben</Pill>
      </div>

      {tab === "nomen"   ? <TrainerFrame src="/genus-trainer.html"   title="Nomen und Artikel — Genus-Trainer" /> :
       tab === "relativ" ? <TrainerFrame src="/relativ-trainer.html" title="Relativsätze — Trainer" /> :
       tab === "lokal"   ? <TrainerFrame src="/lokal-trainer.html"   title="Lokalangaben — Trainer" /> :
       <RoadmapBody state={state} setState={setState} setView={setView} verbs={verbs} />}
    </div>
  );
}

// Self-contained grammar trainers served from public/*.html (same pattern as the
// Verb Meister App). Each keeps its own progress in the visitor's localStorage.
function TrainerFrame({ src, title }) {
  return (
    <div className="mt-4">
      <iframe
        src={src}
        title={title}
        className="w-full block"
        style={{ border: "none", height: "calc(100vh - 130px)", minHeight: "520px", display: "block" }}
      />
    </div>
  );
}

function RoadmapBody({ state, setState, setView, verbs }) {
  const target = ROADMAP[state.level];
  const verbsKnownAtLevel = verbs.filter(
    v => v.lvl <= state.level && state.verbsKnown[v.v]?.correct >= 1
  ).length;
  const grammarSeen = (GRAMMAR[state.level] || []).filter(
    g => state.grammarSeen[`${state.level}-${g.topic}`]
  ).length;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{color: C.forestDark}}>
        Your Roadmap — {state.level}
      </h1>
      <p className="mb-6" style={{color: C.forestMid}}>{target.desc}</p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold" style={{color: C.forestDark}}>Verbs at this level</h3>
            <span className="text-sm" style={{color: C.forestMid}}>{verbsKnownAtLevel} / {target.verbs}</span>
          </div>
          <Progress value={verbsKnownAtLevel} max={target.verbs} color="bg-forest-500" style={{backgroundColor: C.forestLight}} />
          <button
            onClick={() => setView({ section: "lern", tab: "vocab" })}
            className="mt-4 text-sm font-medium transition hover:underline"
            style={{color: C.forestMid}}
          >
            Practice verbs →
          </button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold" style={{color: C.forestDark}}>Grammar topics</h3>
            <span className="text-sm" style={{color: C.forestMid}}>{grammarSeen} / {(GRAMMAR[state.level] || []).length}</span>
          </div>
          <Progress value={grammarSeen} max={(GRAMMAR[state.level] || []).length || 1} color="bg-forest-400" />
          <button
            onClick={() => setView({ section: "lern", tab: "grammar" })}
            className="mt-4 text-sm font-medium transition hover:underline"
            style={{color: C.forestMid}}
          >
            Browse grammar →
          </button>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mb-3" style={{color: C.forestDark}}>Path to fluency</h2>
      <div className="space-y-3">
        {LEVELS.map((lvl, i) => {
          const isCurrent = lvl === state.level;
          const isPast    = LEVELS.indexOf(state.level) > i;

          // Card styles
          const cardStyle = isCurrent
            ? { backgroundColor: C.forest, borderColor: C.forestDark, borderWidth: 2 }
            : isPast
            ? { backgroundColor: C.pastBg, borderColor: C.sageBorder }
            : { backgroundColor: '#ffffff', borderColor: C.sageBorder };

          // Badge styles
          const badgeStyle = isCurrent
            ? { backgroundColor: C.cream, color: C.forestDark, fontWeight: 700 }
            : isPast
            ? { backgroundColor: C.forestLight, color: '#fff' }
            : { backgroundColor: '#e2e8f0', color: '#64748b' };

          // Text styles
          const titleStyle  = { color: isCurrent ? '#ffffff' : C.forestDark };
          const subtitleStyle = { color: isCurrent ? 'rgba(255,255,255,0.75)' : C.forestMid };

          return (
            <button
              key={lvl}
              className="flex items-center gap-4 p-4 rounded-xl border w-full text-left transition-opacity hover:opacity-90 cursor-pointer"
              style={cardStyle}
              onClick={() => {
                setState({ ...state, level: lvl });
                setView({ section: "lern", tab: "grammar" });
              }}
            >
              {/* Level badge */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={badgeStyle}
              >
                {lvl}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold" style={titleStyle}>
                  {lvl} — {ROADMAP[lvl].desc}
                </div>
                <div className="text-sm mt-0.5" style={subtitleStyle}>
                  {ROADMAP[lvl].vocab} words · {ROADMAP[lvl].verbs} verbs · ~{ROADMAP[lvl].hours}h study
                </div>
              </div>

              {/* "Current level" tag for the active row */}
              {isCurrent && (
                <span
                  className="text-xs font-bold px-2 py-1 rounded-full shrink-0"
                  style={{ backgroundColor: C.cream, color: C.forestDark }}
                >
                  Current
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
