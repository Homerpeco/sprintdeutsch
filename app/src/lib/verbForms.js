// Display-form helpers for verbs saved in the Verb Meister App's storage
// (localStorage key "de_verb_tracker_v1", shared with public/verb-tracker.html).
//
// Irregular verbs already carry their conjugated forms in v.conj (typed in
// or auto-detected when the verb was added in Verb Meister). Regular (weak)
// verbs are NOT stored pre-conjugated there — verb-tracker.html derives them
// on the fly with a small weak-verb rule set. This file ports that exact
// logic (regularConj / withSich / Perfekt string) so VerbListeView can show
// the same forms without needing its own copy of the verb data.
//
// Keep this in sync with the `regularConj`/`withSich`/`conjBlock` functions
// inside app/public/verb-tracker.html if that engine ever changes.

export function regularConj(v) {
  let inf = (v.infinitive || "").trim().toLowerCase().replace(/^sich\s+/, "");
  const pfx = (v.separable && v.prefix && inf.startsWith(v.prefix.toLowerCase()))
    ? v.prefix.toLowerCase()
    : "";
  const core = pfx ? inf.slice(pfx.length) : inf;
  let stem;
  if (/(eln|ern)$/.test(core)) stem = core.slice(0, -1); // klingeln → klingel-
  else if (/en$/.test(core)) stem = core.slice(0, -2);
  else if (/n$/.test(core)) stem = core.slice(0, -1);
  else stem = core;
  const eEp = /(?:[td]|chn|ffn|gn|dm|tm)$/.test(stem) ? "e" : ""; // arbeitet, öffnet, atmet
  const sEnd = /(?:s|ß|x|z)$/.test(stem); // reist → reist (not reisst)
  const present3 = stem + (sEnd ? "t" : eEp + "t");
  const pret3 = stem + eEp + "te";
  // no ge- for inseparable prefixes and -ieren verbs
  const noGe = /^(be|ge|emp|ent|er|miss|ver|zer|hinter)/.test(core) || /ieren$/.test(core);
  const part = pfx + (noGe ? "" : "ge") + stem + eEp + "t";
  return {
    present: present3 + (pfx ? " " + pfx : ""),
    preterite: pret3 + (pfx ? " " + pfx : ""),
    partizip: part,
    auxiliary: "haben",
  };
}

// Inserts "sich" after the first word of a conjugated form, for reflexive verbs.
export function withSich(form, v) {
  if (!v.reflexive || !form || /\bsich\b/.test(form)) return form || "";
  const parts = form.split(" ");
  parts.splice(1, 0, "sich");
  return parts.join(" ");
}

// Returns the fully assembled display forms for a saved verb, regardless of
// whether it's irregular (stored conj) or regular (derived on the fly).
export function verbDisplayForms(v) {
  const c = v.irregular && v.conj ? v.conj : regularConj(v);
  const aux = c.auxiliary || "haben";
  const perfekt =
    (aux === "sein" ? "ist" : "hat") +
    (v.reflexive && !/\bsich\b/.test(c.partizip || "") ? " sich " : " ") +
    (c.partizip || "—");
  return {
    present: withSich(c.present, v) || "—",
    preterite: withSich(c.preterite, v) || "—",
    perfekt,
    pattern: v.irregular && v.conj ? c.pattern || "" : "",
    auxiliary: aux,
  };
}

export function verbformenUrl(infinitive) {
  const clean = (infinitive || "").trim().toLowerCase().replace(/^sich\s+/, "");
  return `https://www.verbformen.com/conjugation/?w=${encodeURIComponent(clean)}`;
}
