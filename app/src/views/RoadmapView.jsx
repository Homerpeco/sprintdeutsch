import { GRAMMAR } from '../data/grammar.js';
import { ROADMAP, LEVELS } from '../data/roadmap.js';
import { Card } from '../components/Card.jsx';
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

// ─── Special topics ──────────────────────────────────────────────────────────
// Self-contained grammar trainers served from public/*.html (same pattern as the
// Verb Meister App). Each keeps its own progress in the visitor's localStorage.
// They live at the BOTTOM of the roadmap, not in a permanent tab bar: on a phone
// a wrapping row of pills ate half the screen before the content even started.
const TRAINERS = [
  { id: "nomen",   src: "/genus-trainer.html",   title: "Nomen und Artikel",
    sub: "der · die · das — 23 suffixes, 282 nouns", level: "A1" },
  { id: "relativ", src: "/relativ-trainer.html", title: "Relativsätze",
    sub: "der/die/das · was · wo — 157 exercises", level: "B1" },
  { id: "lokal",   src: "/lokal-trainer.html",   title: "Lokalangaben",
    sub: "wohin · wo · woher — 205 exercises", level: "A2" },
];

export function RoadmapView({ state, setState, view, setView, verbs }) {
  const tab = (view && view.tab) || "roadmap";
  const trainer = TRAINERS.find(t => t.id === tab);

  return (
    <div className="fade-in">
      <style>{`
        .trainer-frame{height:calc(100vh - 118px);min-height:460px}
        @supports (height:100dvh){.trainer-frame{height:calc(100dvh - 118px)}}
        @media (max-width:640px){
          .trainer-frame{height:calc(100vh - 190px);min-height:360px}
        }
        @supports (height:100dvh){
          @media (max-width:640px){.trainer-frame{height:calc(100dvh - 190px)}}
        }
        .trainer-switch{display:flex;gap:6px;align-items:center;overflow-x:auto;
          -webkit-overflow-scrolling:touch;scrollbar-width:none}
        .trainer-switch::-webkit-scrollbar{display:none}
      `}</style>

      {trainer
        ? <>
            {/* one slim, horizontally scrollable line instead of a wrapping pill grid */}
            <div className="px-3 sm:px-6 pt-2 sm:pt-4 max-w-4xl mx-auto trainer-switch">
              <button
                onClick={() => setView({ section: "roadmap", tab: "roadmap" })}
                className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50 transition"
                style={{ color: C.forestDark }}
              >
                ← Roadmap
              </button>
              {TRAINERS.map(t => {
                const active = t.id === trainer.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setView({ section: "roadmap", tab: t.id })}
                    className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm transition ${
                      active ? "font-bold" : "font-medium bg-white border border-slate-200 hover:bg-slate-50"
                    }`}
                    style={active
                      ? { backgroundColor: C.cream, color: C.forestDark, boxShadow: '0 1px 4px rgba(0,0,0,0.20)' }
                      : { color: '#334155' }}
                  >
                    {t.title}
                  </button>
                );
              })}
            </div>
            <div className="mt-2">
              <iframe
                src={trainer.src}
                title={trainer.title}
                className="w-full block trainer-frame"
                style={{ border: "none", display: "block" }}
              />
            </div>
          </>
        : <RoadmapBody state={state} setState={setState} setView={setView} verbs={verbs} />}
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

      {/* ─── Special topics: the self-contained grammar trainers ─────────── */}
      <h2 className="text-lg font-semibold mt-8 mb-1" style={{color: C.forestDark}}>Special topics</h2>
      <p className="text-sm mb-3" style={{color: C.forestMid}}>
        Deep-dive trainers with their own rules, quizzes and saved progress.
      </p>
      <div className="space-y-3">
        {TRAINERS.map(t => (
          <button
            key={t.id}
            onClick={() => setView({ section: "roadmap", tab: t.id })}
            className="flex items-center gap-4 p-4 rounded-xl border w-full text-left transition hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: '#ffffff', borderColor: C.sageBorder }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: C.cream, color: C.forestDark }}
            >
              {t.level}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold" style={{color: C.forestDark}}>{t.title}</div>
              <div className="text-sm mt-0.5" style={{color: C.forestMid}}>{t.sub}</div>
            </div>
            <span className="text-sm font-medium shrink-0" style={{color: C.forestMid}}>Open →</span>
          </button>
        ))}
      </div>
    </div>
  );
}
