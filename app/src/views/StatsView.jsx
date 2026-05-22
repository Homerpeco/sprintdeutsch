import { ROADMAP } from '../data/roadmap.js';
import { Card } from '../components/Card.jsx';
import { Progress } from '../components/Progress.jsx';

export function StatsView({ state, verbs }) {
  const totalVerbs = verbs.length;
  const learned = Object.values(state.verbsKnown).filter(v => v.correct >= 1).length;
  const target = ROADMAP[state.level];

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto fade-in">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Your stats</h1>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <div className="text-sm text-slate-500">Current streak</div>
          <div className="text-3xl font-bold mt-1">{state.streak.current} <span className="text-base font-normal text-slate-500">days</span></div>
          <div className="text-xs text-slate-400 mt-1">Longest: {state.streak.longest}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Verbs learned</div>
          <div className="text-3xl font-bold mt-1">{learned} <span className="text-base font-normal text-slate-500">/ {totalVerbs}</span></div>
          <Progress value={learned} max={totalVerbs} color="bg-emerald-500" />
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Current level target</div>
          <div className="text-3xl font-bold mt-1">{state.level}</div>
          <div className="text-xs text-slate-400 mt-1">{target.verbs} verbs · {target.vocab} words</div>
        </Card>
      </div>

      <Card className="p-5 mb-6">
        <h3 className="font-semibold mb-4">Practice activity</h3>
        {["speaking","writing","reading","listening"].map(skill => (
          <div key={skill} className="mb-3 last:mb-0">
            <div className="flex justify-between text-sm mb-1">
              <span className="capitalize">{skill}</span>
              <span className="text-slate-500">{state.practice[skill]} sessions</span>
            </div>
            <Progress value={state.practice[skill]} max={Math.max(20, state.practice[skill])} color="bg-indigo-500" />
          </div>
        ))}
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Verbs you've struggled with</h3>
        {(() => {
          const struggled = Object.entries(state.verbsKnown)
            .filter(([, s]) => s.seen >= 2 && s.correct / s.seen < 0.5)
            .map(([v]) => v);
          if (!struggled.length) return <p className="text-sm text-slate-500">Nothing here yet. Keep drilling!</p>;
          return (
            <div className="flex flex-wrap gap-2">
              {struggled.map(v => (
                <span key={v} className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-sm border border-rose-200">{v}</span>
              ))}
            </div>
          );
        })()}
      </Card>
    </div>
  );
}
