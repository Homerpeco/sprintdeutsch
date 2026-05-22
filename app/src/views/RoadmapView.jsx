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

export function RoadmapView({ state, setView, verbs }) {
  const target = ROADMAP[state.level];
  const verbsKnownAtLevel = verbs.filter(
    v => v.lvl <= state.level && state.verbsKnown[v.v]?.correct >= 1
  ).length;
  const grammarSeen = (GRAMMAR[state.level] || []).filter(
    g => state.grammarSeen[`${state.level}-${g.topic}`]
  ).length;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto fade-in">
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
            <div
              key={lvl}
              className="flex items-center gap-4 p-4 rounded-xl border"
              style={cardStyle}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
