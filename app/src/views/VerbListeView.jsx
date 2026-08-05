import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card.jsx";
import { Icon } from "../components/Icon.jsx";
import { verbDisplayForms, verbformenUrl } from "../lib/verbForms.js";

// Same storage key as the Verb Meister App (public/verb-tracker.html).
// Verbliste is a read-focused companion view over that SAME data — add a
// verb once (in either place) and it shows up in both. See VerbMeisterView.
const STORAGE_KEY = "de_verb_tracker_v1";
const CASE_LABEL = { A: "Akk.", D: "Dat.", G: "Gen." };

function loadVerbs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Verbliste: could not read saved verbs", e);
    return [];
  }
}

// Loose match so "uber" finds "über", "gruss" finds "Gruß", etc. — makes the
// duplicate check forgiving while typing quickly at your desk.
function normalize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss");
}

export function VerbListeView({ setView }) {
  const [verbs, setVerbs] = useState(loadVerbs);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("az");

  useEffect(() => {
    // Re-read whenever this view mounts (i.e. every time the user switches
    // to this tab) and whenever another same-origin context — the Verb
    // Meister iframe, or another browser tab — writes to the same key.
    const refresh = () => setVerbs(loadVerbs());
    refresh();
    const onStorage = (e) => { if (!e.key || e.key === STORAGE_KEY) refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    let list = verbs;
    if (q) {
      list = list.filter(v =>
        normalize(v.infinitive).includes(q) || normalize(v.meaning).includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      if (sort === "newest") {
        return new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0);
      }
      return (a.infinitive || "").localeCompare(b.infinitive || "", "de");
    });
    return list;
  }, [verbs, query, sort]);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto fade-in">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <h1 className="text-2xl sm:text-3xl font-bold">Verbliste</h1>
        <button
          onClick={() => setVerbs(loadVerbs())}
          className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-white/60 transition"
          title="Refresh"
        >
          ↻ Refresh
        </button>
      </div>
      <p className="text-sm text-slate-600 mb-4">
        Every verb you've saved in Verb Meister, in one scannable list — check here before you write a new physical card.
      </p>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search verb or meaning…"
          autoFocus
          className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="px-2 py-2 rounded-xl border border-slate-300 bg-white text-sm"
          title="Sort"
        >
          <option value="az">A–Z</option>
          <option value="newest">Newest first</option>
        </select>
      </div>

      <div className="text-xs text-slate-500 mb-2">
        {verbs.length} verb{verbs.length === 1 ? "" : "s"} saved
        {query ? ` · ${filtered.length} match${filtered.length === 1 ? "" : "es"}` : ""}
      </div>

      {verbs.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-slate-600 mb-3">No verbs saved yet.</p>
          <p className="text-sm text-slate-500 mb-4">Add verbs in the Verb Meister App and they'll show up here automatically.</p>
          <button
            onClick={() => setView({ section: "verbmeister", tab: null })}
            className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: "#355f1f" }}
          >
            Open Verb Meister App
          </button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-slate-600">No verb matches "{query}" — you don't have this one yet.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="px-3 py-2 font-semibold">Verb</th>
                <th className="px-3 py-2 font-semibold">English</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">3rd pers. present</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Präteritum</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Perfekt</th>
                <th className="px-3 py-2 font-semibold">Pattern</th>
                <th className="px-3 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => {
                const forms = verbDisplayForms(v);
                return (
                  <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 align-top">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-800">
                        {v.reflexive ? "sich " : ""}{v.infinitive}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {v.irregular && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">irregular</span>
                        )}
                        {v.separable && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">separable</span>
                        )}
                        {v.reflexive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700">
                            refl. · {CASE_LABEL[v.reflexiveCase] || "Akk."}
                          </span>
                        )}
                        {(v.prepositions || []).map((p, i) => (
                          <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            +{p.prep} {CASE_LABEL[p.case]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{v.meaning || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{forms.present}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{forms.preterite}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{forms.perfekt}</td>
                    <td className="px-3 py-2 text-slate-600">{forms.pattern || "—"}</td>
                    <td className="px-3 py-2">
                      <a
                        href={verbformenUrl(v.infinitive)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:text-emerald-900 font-medium whitespace-nowrap"
                        title="Full conjugation on verbformen.com"
                      >
                        ↗ verbformen
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
