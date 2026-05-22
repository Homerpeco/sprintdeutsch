import { useMemo } from 'react';
import { GRAMMAR } from '../data/grammar.js';
import { LEVELS } from '../data/roadmap.js';
import { srsKey, srsUpdate, dueIn, dueLabel } from '../lib/srs.js';
import { buildLearnPrompt, buildQuizPrompt } from '../lib/prompts.js';
import { Card } from '../components/Card.jsx';
import { SRSRatingButtons } from '../components/SRSRatingButtons.jsx';
import { Icon } from '../components/Icon.jsx';

export function WiederholungView({ state, setState, openTutor }) {
  const allCards = useMemo(() => {
    const out = [];
    for (const lvl of LEVELS) {
      for (const t of (GRAMMAR[lvl] || [])) {
        const k = srsKey(lvl, t.topic);
        out.push({ level: lvl, topic: t.topic, desc: t.desc, dataKey: t.dataKey, key: k, srs: state.srs?.[k] });
      }
    }
    return out;
  }, [state.srs]);

  const now = Date.now();
  const studied   = allCards.filter(c => c.srs);
  const due       = studied.filter(c => c.srs.due <= now).sort((a, b) => a.srs.due - b.srs.due);
  const upcoming  = studied.filter(c => c.srs.due > now).sort((a, b) => a.srs.due - b.srs.due).slice(0, 6);
  const unstudied = allCards.filter(c => !c.srs);

  const totalSuccess = studied.reduce((n, c) => n + (c.srs.successCount || 0), 0);
  const totalFail    = studied.reduce((n, c) => n + (c.srs.failCount    || 0), 0);
  const totalRatings = totalSuccess + totalFail;
  const accuracy = totalRatings ? Math.round(100 * totalSuccess / totalRatings) : 0;

  function rate(card, quality) {
    const next = srsUpdate(card.srs, quality);
    setState({ ...state, srs: { ...state.srs, [card.key]: next } });
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto fade-in">
      <h1 className="text-2xl sm:text-3xl font-bold mb-1">Wiederholung</h1>
      <p className="text-slate-600 mb-6">Spaced-repetition queue. Topics surface as you start to forget them.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="p-4"><div className="text-2xl font-bold">{due.length}</div><div className="text-xs text-slate-500">Fällig jetzt</div></Card>
        <Card className="p-4"><div className="text-2xl font-bold">{studied.length}</div><div className="text-xs text-slate-500">Im System</div></Card>
        <Card className="p-4"><div className="text-2xl font-bold">{unstudied.length}</div><div className="text-xs text-slate-500">Noch nicht angefangen</div></Card>
        <Card className="p-4"><div className="text-2xl font-bold">{totalRatings ? `${accuracy}%` : "—"}</div><div className="text-xs text-slate-500">Trefferquote ({totalRatings} Bewertungen)</div></Card>
      </div>

      {due.length > 0 ? (
        <>
          <h2 className="text-lg font-semibold mb-3">Fällig ({due.length})</h2>
          <div className="space-y-3 mb-6">
            {due.map(c => (
              <div key={c.key} className="p-4 rounded-xl border border-rose-300 bg-rose-50">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs font-medium text-indigo-600 bg-white px-2 py-0.5 rounded">{c.level}</span>
                  <div className="font-medium">{c.topic}</div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">{dueLabel(dueIn(c.srs))}</span>
                </div>
                <div className="text-sm text-slate-600 mt-1">{c.desc}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => openTutor && openTutor(buildQuizPrompt(c.level, c.topic, state.contextDomain), c.topic)}
                    className="text-xs font-medium text-fuchsia-600 hover:text-fuchsia-700 flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-fuchsia-200"
                  >
                    <Icon.Sparkle className="w-3 h-3" /> Quiz mit KI starten
                  </button>
                  <button
                    onClick={() => openTutor && openTutor(buildLearnPrompt(c.level, c.topic, state.contextDomain), c.topic)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-indigo-200"
                  >
                    <Icon.Sparkle className="w-3 h-3" /> Nochmal erklären
                  </button>
                  <SRSRatingButtons srs={c.srs} onRate={(q) => rate(c, q)} />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Card className="p-5 mb-6 bg-emerald-50 border-emerald-200">
          <div className="font-semibold text-emerald-700">Alles aktuell — nichts fällig.</div>
          <p className="text-sm text-emerald-700/80 mt-1">
            {studied.length === 0
              ? "Bewerte ein Thema in der Grammar-Liste mit Wieder / Schwer / Gut, um es ins SRS aufzunehmen."
              : "Nächste Wiederholungen siehst du unten."}
          </p>
        </Card>
      )}

      {upcoming.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3">Demnächst</h2>
          <div className="space-y-2 mb-6">
            {upcoming.map(c => (
              <div key={c.key} className="px-4 py-2 rounded-lg bg-white border border-slate-200 flex items-center gap-3 text-sm">
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{c.level}</span>
                <span className="flex-1 truncate">{c.topic}</span>
                <span className="text-slate-500 text-xs whitespace-nowrap">{dueLabel(dueIn(c.srs))}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {studied.length === 0 && (
        <Card className="p-5 bg-slate-50 border-slate-200">
          <h3 className="font-semibold mb-2">So funktioniert's</h3>
          <ol className="text-sm text-slate-600 space-y-1 list-decimal pl-5">
            <li>Geh zu <span className="font-medium">Lern → Grammar</span> auf deinem aktuellen Level.</li>
            <li>Klick <span className="font-medium">Quiz starten</span> oder <span className="font-medium">Mit KI lernen</span> auf einem Thema.</li>
            <li>Nach dem Quiz: bewerte dich mit <span className="text-rose-600 font-medium">Wieder</span> / <span className="text-amber-600 font-medium">Schwer</span> / <span className="text-emerald-600 font-medium">Gut</span>.</li>
            <li>SM-2 setzt den nächsten Termin. Fehlversuche → morgen. Klare Treffer → 6 Tage, dann ×Leichtigkeit.</li>
          </ol>
        </Card>
      )}
    </div>
  );
}
