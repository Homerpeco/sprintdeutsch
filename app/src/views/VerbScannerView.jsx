import React, { useState, useEffect } from 'react';

// --- DATABASE & CONFIGURATION ---
const COLORS = {
  1: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', active: 'bg-blue-600', fill: 'bg-blue-500' },     
  2: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', active: 'bg-indigo-600', fill: 'bg-indigo-500' }, 
  3: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', active: 'bg-violet-600', fill: 'bg-violet-500' }, 
  4: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', active: 'bg-purple-600', fill: 'bg-purple-500' }, 
  5: { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-700', active: 'bg-fuchsia-600', fill: 'bg-fuchsia-500' }, 
  6: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', active: 'bg-rose-600', fill: 'bg-rose-500' },       
  7: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', active: 'bg-red-600', fill: 'bg-red-500' },          
  8: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', active: 'bg-orange-600', fill: 'bg-orange-500' }, 
  9: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', active: 'bg-amber-600', fill: 'bg-amber-500' }     
};

const PATTERNS = [
  { id: 1, vowels: 'ei-ie-ie', guide: 'bleiben' },
  { id: 2, vowels: 'ei-i-i', guide: 'beißen' },
  { id: 3, vowels: 'ie-o-o', guide: 'biegen' },
  { id: 4, vowels: 'i-a-u', guide: 'binden' },
  { id: 5, vowels: 'e-a-o', guide: 'helfen' },
  { id: 6, vowels: 'e-a-e', guide: 'essen' },
  { id: 7, vowels: 'a-u-a', guide: 'fahren' },
  { id: 8, vowels: 'a-ie-a', guide: 'fallen' },
  { id: 9, vowels: 'e-a-a', guide: 'stehen' }
];

const FULL_CONJUGATIONS = {
  bleiben: { praesens: ['ich bleibe', 'du bleibst', 'er/sie/es bleibt', 'wir bleiben', 'ihr bleibt', 'sie/Sie bleiben'], praeteritum: ['ich blieb', 'du bliebst', 'er/sie/es blieb', 'wir blieben', 'ihr bliebt', 'sie/Sie blieben'], perfekt: ['ich bin geblieben', 'du bist geblieben', 'er ist geblieben', 'wir sind geblieben', 'ihr seid geblieben', 'sie sind geblieben'] },
  beißen: { praesens: ['ich beiße', 'du beißt', 'er/sie/es beißt', 'wir beißen', 'ihr beißt', 'sie/Sie beißen'], praeteritum: ['ich biss', 'du bissest', 'er/sie/es biss', 'wir bissen', 'ihr bisst', 'sie/Sie bissen'], perfekt: ['ich habe gebissen', 'du hast gebissen', 'er hat gebissen', 'wir haben gebissen', 'ihr habt gebissen', 'sie haben gebissen'] },
  biegen: { praesens: ['ich biege', 'du biegst', 'er/sie/es biegt', 'wir biegen', 'ihr biegt', 'sie/Sie biegen'], praeteritum: ['ich bog', 'du bogst', 'er/sie/es bog', 'wir bogen', 'ihr bogt', 'sie/Sie bogen'], perfekt: ['ich habe/bin gebogen', 'du hast/bist gebogen', 'er hat/ist gebogen', 'wir haben/sind gebogen', 'ihr habt/seid gebogen', 'sie haben/sind gebogen'] },
  binden: { praesens: ['ich binde', 'du bindest', 'er/sie/es bindet', 'wir binden', 'ihr bindet', 'sie/Sie binden'], praeteritum: ['ich band', 'du bandest', 'er/sie/es band', 'wir banden', 'ihr bandet', 'sie/Sie banden'], perfekt: ['ich habe gebunden', 'du hast gebunden', 'er hat gebunden', 'wir haben gebunden', 'ihr habt gebunden', 'sie haben gebunden'] },
  helfen: { praesens: ['ich helfe', 'du hilfst', 'er/sie/es hilft', 'wir helfen', 'ihr helft', 'sie/Sie helfen'], praeteritum: ['ich half', 'du halfst', 'er/sie/es half', 'wir halfen', 'ihr halft', 'sie/Sie halfen'], perfekt: ['ich habe geholfen', 'du hast geholfen', 'er hat geholfen', 'wir haben geholfen', 'ihr habt geholfen', 'sie haben geholfen'] },
  essen: { praesens: ['ich esse', 'du isst', 'er/sie/es isst', 'wir essen', 'ihr esst', 'sie/Sie essen'], praeteritum: ['ich aß', 'du aßest', 'er/sie/es aß', 'wir aßen', 'ihr aßt', 'sie/Sie aßen'], perfekt: ['ich habe gegessen', 'du hast gegessen', 'er hat gegessen', 'wir haben gegessen', 'ihr habt gegessen', 'sie haben gegessen'] },
  fahren: { praesens: ['ich fahre', 'du fährst', 'er/sie/es fährt', 'wir fahren', 'ihr fahrt', 'sie/Sie fahren'], praeteritum: ['ich fuhr', 'du fuhrst', 'er/sie/es fuhr', 'wir fuhren', 'ihr fuhrt', 'sie/Sie fuhren'], perfekt: ['ich bin/habe gefahren', 'du bist/hast gefahren', 'er ist/hat gefahren', 'wir sind/haben gefahren', 'ihr seid/habt gefahren', 'sie sind/haben gefahren'] },
  fallen: { praesens: ['ich falle', 'du fällst', 'er/sie/es fällt', 'wir fallen', 'ihr fallt', 'sie/Sie fallen'], praeteritum: ['ich fiel', 'du fielst', 'er/sie/es fiel', 'wir fielen', 'ihr fielt', 'sie/Sie fielen'], perfekt: ['ich bin gefallen', 'du bist gefallen', 'er ist gefallen', 'wir sind gefallen', 'ihr seid gefallen', 'sie sind gefallen'] },
  stehen: { praesens: ['ich stehe', 'du stehst', 'er/sie/es steht', 'wir stehen', 'ihr steht', 'sie/Sie stehen'], praeteritum: ['ich stand', 'du standst', 'er/sie/es stand', 'wir standen', 'ihr standet', 'sie/Sie standen'], perfekt: ['ich habe/bin gestanden', 'du hast/bist gestanden', 'er hat/ist gestanden', 'wir haben/sind gestanden', 'ihr habt/seid gestanden', 'sie haben/sind gestanden'] }
};

// 90 B2 Verbs for true randomness offline
const VERBS = [
  // 1. ei-ie-ie
  { infinitive: 'bleiben', praesens: 'bleibt', praeteritum: 'blieb', perfekt: 'ist geblieben', pattern: 'ei-ie-ie', id: 1 },
  { infinitive: 'schreiben', praesens: 'schreibt', praeteritum: 'schrieb', perfekt: 'hat geschrieben', pattern: 'ei-ie-ie', id: 1 },
  { infinitive: 'steigen', praesens: 'steigt', praeteritum: 'stieg', perfekt: 'ist gestiegen', pattern: 'ei-ie-ie', id: 1 },
  { infinitive: 'scheinen', praesens: 'scheint', praeteritum: 'schien', perfekt: 'hat geschienen', pattern: 'ei-ie-ie', id: 1 },
  { infinitive: 'schweigen', praesens: 'schweigt', praeteritum: 'schwieg', perfekt: 'hat geschwiegen', pattern: 'ei-ie-ie', id: 1 },
  { infinitive: 'verzeihen', praesens: 'verzeiht', praeteritum: 'verzieh', perfekt: 'hat verziehen', pattern: 'ei-ie-ie', id: 1 },
  { infinitive: 'weisen', praesens: 'weist', praeteritum: 'wies', perfekt: 'hat gewiesen', pattern: 'ei-ie-ie', id: 1 },
  { infinitive: 'treiben', praesens: 'treibt', praeteritum: 'trieb', perfekt: 'hat getrieben', pattern: 'ei-ie-ie', id: 1 },
  { infinitive: 'meiden', praesens: 'meidet', praeteritum: 'mied', perfekt: 'hat gemieden', pattern: 'ei-ie-ie', id: 1 },
  // 2. ei-i-i
  { infinitive: 'beißen', praesens: 'beißt', praeteritum: 'biss', perfekt: 'hat gebissen', pattern: 'ei-i-i', id: 2 },
  { infinitive: 'schneiden', praesens: 'schneidet', praeteritum: 'schnitt', perfekt: 'hat geschnitten', pattern: 'ei-i-i', consonantShift: 'd-tt', id: 2 },
  { infinitive: 'leiden', praesens: 'leidet', praeteritum: 'litt', perfekt: 'hat gelitten', pattern: 'ei-i-i', consonantShift: 'd-tt', id: 2 },
  { infinitive: 'gleiten', praesens: 'gleitet', praeteritum: 'glitt', perfekt: 'ist geglitten', pattern: 'ei-i-i', id: 2 },
  { infinitive: 'greifen', praesens: 'greift', praeteritum: 'griff', perfekt: 'hat gegriffen', pattern: 'ei-i-i', id: 2 },
  { infinitive: 'reißen', praesens: 'reißt', praeteritum: 'riss', perfekt: 'hat gerissen', pattern: 'ei-i-i', id: 2 },
  { infinitive: 'reiten', praesens: 'reitet', praeteritum: 'ritt', perfekt: 'ist geritten', pattern: 'ei-i-i', id: 2 },
  { infinitive: 'streiten', praesens: 'streitet', praeteritum: 'stritt', perfekt: 'hat gestritten', pattern: 'ei-i-i', id: 2 },
  { infinitive: 'pfeifen', praesens: 'pfeift', praeteritum: 'pfiff', perfekt: 'hat gepfiffen', pattern: 'ei-i-i', id: 2 },
  { infinitive: 'schleichen', praesens: 'schleicht', praeteritum: 'schlich', perfekt: 'ist geschlichen', pattern: 'ei-i-i', id: 2 },
  // 3. ie-o-o
  { infinitive: 'biegen', praesens: 'biegt', praeteritum: 'bog', perfekt: 'hat gebogen', pattern: 'ie-o-o', id: 3 },
  { infinitive: 'fliegen', praesens: 'fliegt', praeteritum: 'flog', perfekt: 'ist geflogen', pattern: 'ie-o-o', id: 3 },
  { infinitive: 'ziehen', praesens: 'zieht', praeteritum: 'zog', perfekt: 'hat gezogen', pattern: 'ie-o-o', consonantShift: 'h-g', id: 3 },
  { infinitive: 'bieten', praesens: 'bietet', praeteritum: 'bot', perfekt: 'hat geboten', pattern: 'ie-o-o', id: 3 },
  { infinitive: 'fliehen', praesens: 'flieht', praeteritum: 'floh', perfekt: 'ist geflohen', pattern: 'ie-o-o', id: 3 },
  { infinitive: 'fließen', praesens: 'fließt', praeteritum: 'floss', perfekt: 'ist geflossen', pattern: 'ie-o-o', id: 3 },
  { infinitive: 'frieren', praesens: 'friert', praeteritum: 'fror', perfekt: 'hat gefroren', pattern: 'ie-o-o', id: 3 },
  { infinitive: 'schließen', praesens: 'schließt', praeteritum: 'schloss', perfekt: 'hat geschlossen', pattern: 'ie-o-o', id: 3 },
  { infinitive: 'verlieren', praesens: 'verliert', praeteritum: 'verlor', perfekt: 'hat verloren', pattern: 'ie-o-o', id: 3 },
  { infinitive: 'wiegen', praesens: 'wiegt', praeteritum: 'wog', perfekt: 'hat gewogen', pattern: 'ie-o-o', id: 3 },
  { infinitive: 'schieben', praesens: 'schiebt', praeteritum: 'schob', perfekt: 'hat geschoben', pattern: 'ie-o-o', id: 3 },
  // 4. i-a-u
  { infinitive: 'binden', praesens: 'bindet', praeteritum: 'band', perfekt: 'hat gebunden', pattern: 'i-a-u', id: 4 },
  { infinitive: 'singen', praesens: 'singt', praeteritum: 'sang', perfekt: 'hat gesungen', pattern: 'i-a-u', id: 4 },
  { infinitive: 'trinken', praesens: 'trinkt', praeteritum: 'trank', perfekt: 'hat getrunken', pattern: 'i-a-u', id: 4 },
  { infinitive: 'finden', praesens: 'findet', praeteritum: 'fand', perfekt: 'hat gefunden', pattern: 'i-a-u', id: 4 },
  { infinitive: 'gelingen', praesens: 'gelingt', praeteritum: 'gelang', perfekt: 'ist gelungen', pattern: 'i-a-u', id: 4 },
  { infinitive: 'klingen', praesens: 'klingt', praeteritum: 'klang', perfekt: 'hat geklungen', pattern: 'i-a-u', id: 4 },
  { infinitive: 'sinken', praesens: 'sinkt', praeteritum: 'sank', perfekt: 'ist gesunken', pattern: 'i-a-u', id: 4 },
  { infinitive: 'springen', praesens: 'springt', praeteritum: 'sprang', perfekt: 'ist gesprungen', pattern: 'i-a-u', id: 4 },
  { infinitive: 'zwingen', praesens: 'zwingt', praeteritum: 'zwang', perfekt: 'hat gezwungen', pattern: 'i-a-u', id: 4 },
  // 5. e-a-o
  { infinitive: 'helfen', praesens: 'hilft', praeteritum: 'half', perfekt: 'hat geholfen', pattern: 'e-a-o', vowelShift: true, id: 5 },
  { infinitive: 'sterben', praesens: 'stirbt', praeteritum: 'starb', perfekt: 'ist gestorben', pattern: 'e-a-o', vowelShift: true, id: 5 },
  { infinitive: 'sprechen', praesens: 'spricht', praeteritum: 'sprach', perfekt: 'hat gesprochen', pattern: 'e-a-o', vowelShift: true, id: 5 },
  { infinitive: 'treffen', praesens: 'trifft', praeteritum: 'traf', perfekt: 'hat getroffen', pattern: 'e-a-o', vowelShift: true, id: 5 },
  { infinitive: 'gelten', praesens: 'gilt', praeteritum: 'galt', perfekt: 'hat gegolten', pattern: 'e-a-o', vowelShift: true, id: 5 },
  { infinitive: 'werfen', praesens: 'wirft', praeteritum: 'warf', perfekt: 'hat geworfen', pattern: 'e-a-o', vowelShift: true, id: 5 },
  { infinitive: 'nehmen', praesens: 'nimmt', praeteritum: 'nahm', perfekt: 'hat genommen', pattern: 'e-a-o', vowelShift: true, id: 5 },
  { infinitive: 'empfehlen', praesens: 'empfiehlt', praeteritum: 'empfahl', perfekt: 'hat empfohlen', pattern: 'e-a-o', vowelShift: true, id: 5 },
  { infinitive: 'brechen', praesens: 'bricht', praeteritum: 'brach', perfekt: 'hat gebrochen', pattern: 'e-a-o', vowelShift: true, id: 5 },
  { infinitive: 'erschrecken', praesens: 'erschrickt', praeteritum: 'erschrak', perfekt: 'ist erschrocken', pattern: 'e-a-o', vowelShift: true, id: 5 },
  { infinitive: 'stehlen', praesens: 'stiehlt', praeteritum: 'stahl', perfekt: 'hat gestohlen', pattern: 'e-a-o', vowelShift: true, id: 5 },
  { infinitive: 'befehlen', praesens: 'befiehlt', praeteritum: 'befahl', perfekt: 'hat befohlen', pattern: 'e-a-o', vowelShift: true, id: 5 },
  // 6. e-a-e
  { infinitive: 'essen', praesens: 'isst', praeteritum: 'aß', perfekt: 'hat gegessen', pattern: 'e-a-e', vowelShift: true, id: 6 },
  { infinitive: 'geben', praesens: 'gibt', praeteritum: 'gab', perfekt: 'hat gegeben', pattern: 'e-a-e', vowelShift: true, id: 6 },
  { infinitive: 'sehen', praesens: 'sieht', praeteritum: 'sah', perfekt: 'hat gesehen', pattern: 'e-a-e', vowelShift: true, id: 6 },
  { infinitive: 'lesen', praesens: 'liest', praeteritum: 'las', perfekt: 'hat gelesen', pattern: 'e-a-e', vowelShift: true, id: 6 },
  { infinitive: 'messen', praesens: 'misst', praeteritum: 'maß', perfekt: 'hat gemessen', pattern: 'e-a-e', vowelShift: true, id: 6 },
  { infinitive: 'treten', praesens: 'tritt', praeteritum: 'trat', perfekt: 'ist getreten', pattern: 'e-a-e', vowelShift: true, id: 6 },
  { infinitive: 'vergessen', praesens: 'vergisst', praeteritum: 'vergaß', perfekt: 'hat vergessen', pattern: 'e-a-e', vowelShift: true, id: 6 },
  { infinitive: 'geschehen', praesens: 'geschieht', praeteritum: 'geschah', perfekt: 'ist geschehen', pattern: 'e-a-e', vowelShift: true, id: 6 },
  // 7. a-u-a
  { infinitive: 'fahren', praesens: 'fährt', praeteritum: 'fuhr', perfekt: 'ist gefahren', pattern: 'a-u-a', primaryUmlaut: true, id: 7 },
  { infinitive: 'schlagen', praesens: 'schlägt', praeteritum: 'schlug', perfekt: 'hat geschlagen', pattern: 'a-u-a', primaryUmlaut: true, id: 7 },
  { infinitive: 'tragen', praesens: 'trägt', praeteritum: 'trug', perfekt: 'hat getragen', pattern: 'a-u-a', primaryUmlaut: true, id: 7 },
  { infinitive: 'backen', praesens: 'bäckt', praeteritum: 'buk', perfekt: 'hat gebacken', pattern: 'a-u-a', primaryUmlaut: true, id: 7 },
  { infinitive: 'graben', praesens: 'gräbt', praeteritum: 'grub', perfekt: 'hat gegraben', pattern: 'a-u-a', primaryUmlaut: true, id: 7 },
  { infinitive: 'laden', praesens: 'lädt', praeteritum: 'lud', perfekt: 'hat geladen', pattern: 'a-u-a', primaryUmlaut: true, id: 7 },
  { infinitive: 'waschen', praesens: 'wäscht', praeteritum: 'wusch', perfekt: 'hat gewaschen', pattern: 'a-u-a', primaryUmlaut: true, id: 7 },
  { infinitive: 'wachsen', praesens: 'wächst', praeteritum: 'wuchs', perfekt: 'ist gewachsen', pattern: 'a-u-a', primaryUmlaut: true, id: 7 },
  { infinitive: 'schaffen', praesens: 'schafft', praeteritum: 'schuf', perfekt: 'hat geschaffen', pattern: 'a-u-a', id: 7 }, // irregular meaning 'create'
  // 8. a-ie-a
  { infinitive: 'fallen', praesens: 'fällt', praeteritum: 'fiel', perfekt: 'ist gefallen', pattern: 'a-ie-a', primaryUmlaut: true, id: 8 },
  { infinitive: 'lassen', praesens: 'lässt', praeteritum: 'ließ', perfekt: 'hat gelassen', pattern: 'a-ie-a', primaryUmlaut: true, id: 8 },
  { infinitive: 'schlafen', praesens: 'schläft', praeteritum: 'schlief', perfekt: 'hat geschlafen', pattern: 'a-ie-a', primaryUmlaut: true, id: 8 },
  { infinitive: 'braten', praesens: 'brät', praeteritum: 'briet', perfekt: 'hat gebraten', pattern: 'a-ie-a', primaryUmlaut: true, id: 8 },
  { infinitive: 'halten', praesens: 'hält', praeteritum: 'hielt', perfekt: 'hat gehalten', pattern: 'a-ie-a', primaryUmlaut: true, id: 8 },
  { infinitive: 'raten', praesens: 'rät', praeteritum: 'riet', perfekt: 'hat geraten', pattern: 'a-ie-a', primaryUmlaut: true, id: 8 },
  { infinitive: 'blasen', praesens: 'bläst', praeteritum: 'blies', perfekt: 'hat geblasen', pattern: 'a-ie-a', primaryUmlaut: true, id: 8 },
  // 9. e-a-a
  { infinitive: 'stehen', praesens: 'steht', praeteritum: 'stand', perfekt: 'hat gestanden', pattern: 'e-a-a', id: 9 },
  { infinitive: 'bestehen', praesens: 'besteht', praeteritum: 'bestand', perfekt: 'hat bestanden', pattern: 'e-a-a', inseparable: true, id: 9 },
  { infinitive: 'verstehen', praesens: 'versteht', praeteritum: 'verstand', perfekt: 'hat verstanden', pattern: 'e-a-a', inseparable: true, id: 9 },
  { infinitive: 'entstehen', praesens: 'entsteht', praeteritum: 'entstand', perfekt: 'ist entstanden', pattern: 'e-a-a', inseparable: true, id: 9 },
  { infinitive: 'gestehen', praesens: 'gesteht', praeteritum: 'gestand', perfekt: 'hat gestanden', pattern: 'e-a-a', inseparable: true, id: 9 }
];

// Ablaut EXCEPTIONS — verbs whose pattern is NOT one of the 9 master patterns.
// a-i-a (the fangen family + hängen): the Präteritum vowel is a short "i", so it is
// closest to Reihe 8 (a-ie-a) but doesn't truly match it. Kept out of the 9-pattern
// Quiz/Challenge pools; the Scanner labels them explicitly as exceptions.
const EXCEPTIONS = [
  { infinitive: 'fangen',    praesens: 'fängt',    praeteritum: 'fing',    perfekt: 'hat gefangen',   pattern: 'a-i-a', closestReihe: 8 },
  { infinitive: 'anfangen',  praesens: 'fängt an', praeteritum: 'fing an', perfekt: 'hat angefangen', pattern: 'a-i-a', closestReihe: 8 },
  { infinitive: 'empfangen', praesens: 'empfängt', praeteritum: 'empfing', perfekt: 'hat empfangen',  pattern: 'a-i-a', closestReihe: 8 },
  { infinitive: 'hängen',    praesens: 'hängt',    praeteritum: 'hing',    perfekt: 'hat gehangen',   pattern: 'a-i-a', closestReihe: 8 },
];

// Returns the CONFIRMED conjugation/pattern for a verb we already know (from the
// built-in tables), or null. Used to override the AI's pattern (which it sometimes
// gets wrong) while still letting the AI supply meaning/synonyms/antonyms.
function getVerified(input) {
  const known = VERBS.find(v => v.infinitive.toLowerCase() === input);
  if (known) {
    const parts3 = known.perfekt.replace(/^(hat|ist)\s+/i, '');
    return {
      success: true, infinitive: known.infinitive,
      praesens: `er ${known.praesens}`, praeteritum: `er ${known.praeteritum}`, perfekt: `er ${known.perfekt}`,
      pattern: known.pattern, reihe: known.id, exception: false,
      msg: `“${known.infinitive}” is a strong/irregular verb in Ablautreihe ${known.id} (${known.pattern}). Principal parts: ${known.infinitive} – ${known.praeteritum} – ${parts3}. (Verified from the built-in verb table.)`,
    };
  }
  const exc = EXCEPTIONS.find(v => v.infinitive.toLowerCase() === input);
  if (exc) {
    const parts3 = exc.perfekt.replace(/^(hat|ist)\s+/i, '');
    return {
      success: true, exception: true, infinitive: exc.infinitive,
      praesens: `er ${exc.praesens}`, praeteritum: `er ${exc.praeteritum}`, perfekt: `er ${exc.perfekt}`,
      pattern: exc.pattern, reihe: exc.closestReihe,
      msg: `“${exc.infinitive}” has the ablaut a-i-a (${exc.infinitive} – ${exc.praeteritum} – ${parts3}). ⚠ Exception: a-i-a is NOT one of the 9 master patterns — it is closest to Reihe 8 (a-ie-a, like fallen), but its Präteritum vowel is a short “i”, not “ie”. Only the fangen family (fangen, anfangen, empfangen…) and hängen follow it. (Verified from the built-in verb table.)`,
    };
  }
  return null;
}

// --- MAIN COMPONENT ---
export function VerbScannerView() {
  const [activeTab, setActiveTab] = useState('Lernmodus');
  const [selectedGuideVerb, setSelectedGuideVerb] = useState(null);
  const [selectedGuidePatternId, setSelectedGuidePatternId] = useState(null);

  const navigateToLernmodus = (guideVerb, patternId) => {
    setActiveTab('Lernmodus');
    setSelectedGuideVerb(guideVerb);
    setSelectedGuidePatternId(patternId);
  };

  return (
    <div className="w-full bg-slate-50 text-slate-800 font-sans selection:bg-indigo-200 pb-32">
      {/* Header / Nav */}
      <header className="bg-white shadow-sm sticky top-0 z-10 rounded-t-xl overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-800 flex items-center gap-2">
            🔍 Verb Scanner
          </h1>
          <nav className="flex flex-wrap justify-center gap-1 mt-3 sm:mt-0 bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
            {['Lernmodus', 'Quiz', 'Challenge', 'Scanner'].map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedGuideVerb(null); }}
                className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all flex-1 text-center touch-manipulation ${
                  activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'Quiz' ? 'Quiz-Modus' : tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'Lernmodus' && <Lernmodus preSelectedVerb={selectedGuideVerb} preSelectedPatternId={selectedGuidePatternId} />}
        {activeTab === 'Quiz' && <QuizModus />}
        {activeTab === 'Challenge' && <ChallengeModus />}
        {activeTab === 'Scanner' && <ScannerModus onNavigate={navigateToLernmodus} />}
      </main>
    </div>
  );
}

// --- LERNMODUS COMPONENT ---
function Lernmodus({ preSelectedVerb, preSelectedPatternId }) {
  const [selectedVerb, setSelectedVerb] = useState(preSelectedVerb || null);
  const [selectedId, setSelectedId] = useState(preSelectedPatternId || null);

  useEffect(() => {
    if (preSelectedVerb) {
      setSelectedVerb(preSelectedVerb);
      setSelectedId(preSelectedPatternId);
    }
  }, [preSelectedVerb, preSelectedPatternId]);

  return (
    <div className="fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Die 9 Master Patterns</h2>
        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
          Click on a color-coded pattern to study the full conjugation of its guiding verb.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {PATTERNS.map((p) => {
          const c = COLORS[p.id];
          return (
            <button 
              key={p.id}
              onClick={() => { setSelectedVerb(p.guide); setSelectedId(p.id); }}
              className="relative bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-left overflow-hidden active:bg-gray-50 hover:shadow-md transition-all touch-manipulation"
            >
              <div className={`absolute top-0 left-0 w-1.5 h-full ${c.fill}`}></div>
              <div className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Reihe {p.id}</div>
              <div className={`text-lg sm:text-xl font-bold ${c.text} mb-1`}>{p.vowels}</div>
              <div className="text-gray-600 font-medium text-xs sm:text-sm">{p.guide}</div>
            </button>
          );
        })}
      </div>

      {selectedVerb && (
        <ConjugationModal 
          verb={selectedVerb} 
          patternId={selectedId}
          pattern={PATTERNS.find(p => p.guide === selectedVerb)?.vowels}
          onClose={() => setSelectedVerb(null)} 
        />
      )}
    </div>
  );
}

function ConjugationModal({ verb, pattern, patternId, onClose }) {
  const data = FULL_CONJUGATIONS[verb];
  if (!data) return null;
  const c = COLORS[patternId] || { active: 'bg-slate-800' };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl fade-in" onClick={e => e.stopPropagation()}>
        <div className={`px-5 py-4 sm:px-6 sm:py-5 flex justify-between items-center text-white shrink-0 ${c.active}`}>
          <div>
            <h3 className="text-2xl sm:text-3xl font-bold">{verb}</h3>
            <p className="text-white/80 text-xs sm:text-sm font-medium mt-1">Ablautreihe: {pattern}</p>
          </div>
          <button onClick={onClose} className="text-white font-bold text-2xl p-2 hover:opacity-80 touch-manipulation">
            &times;
          </button>
        </div>
        
        <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 overflow-y-auto">
          <TenseColumn title="Präsens" forms={data.praesens} />
          <TenseColumn title="Präteritum" forms={data.praeteritum} />
          <TenseColumn title="Perfekt" forms={data.perfekt} />
        </div>
      </div>
    </div>
  );
}

function TenseColumn({ title, forms }) {
  const pronouns = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];
  return (
    <div>
      <h4 className="font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-3 text-sm sm:text-base">{title}</h4>
      <ul className="space-y-2 text-xs sm:text-sm">
        {forms.map((form, i) => (
          <li key={i} className="flex flex-col">
            <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-bold tracking-wider">{pronouns[i]}</span>
            <span className="font-medium text-slate-900">{form.replace(pronouns[i], '').trim()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- QUIZ-MODUS COMPONENT ---
function QuizModus() {
  const [currentVerb, setCurrentVerb] = useState(() => VERBS[Math.floor(Math.random() * VERBS.length)]);
  const [answers, setAnswers] = useState({ praeteritum: '', perfekt: '', pattern: '' });
  const [feedback, setFeedback] = useState(null);

  const loadRandomVerb = () => {
    setCurrentVerb(VERBS[Math.floor(Math.random() * VERBS.length)]);
    setAnswers({ praeteritum: '', perfekt: '', pattern: '' });
    setFeedback(null);
  };

  const checkAnswers = () => {
    const isPraetCorrect = answers.praeteritum.toLowerCase().trim() === currentVerb.praeteritum.toLowerCase();
    const isPerfektCorrect = answers.perfekt.toLowerCase().trim() === currentVerb.perfekt.toLowerCase();
    const isPatternCorrect = answers.pattern === currentVerb.pattern;

    if (isPraetCorrect && isPerfektCorrect && isPatternCorrect) {
      setFeedback({ status: 'correct', msg: 'Hervorragend! Alles richtig.' });
    } else {
      setFeedback({ 
        status: 'incorrect', 
        msg: 'Nicht ganz...',
        correctPraet: currentVerb.praeteritum,
        correctPerfekt: currentVerb.perfekt,
        correctPattern: currentVerb.pattern
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!feedback) checkAnswers();
      else loadRandomVerb();
    }
  };

  const vc = COLORS[currentVerb.id];

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-8 fade-in">
      <div className="text-center mb-6">
        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] sm:text-xs font-bold tracking-widest uppercase mb-2">
          Quiz-Modus
        </span>
        <h2 className={`text-3xl sm:text-4xl font-extrabold ${vc.text}`}>{currentVerb.infinitive}</h2>
        <p className="text-slate-500 mt-1 text-xs sm:text-sm">Fill in the correct forms for er/sie/es.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Präteritum (er/sie/es)</label>
          <input 
            type="text" 
            className="w-full border border-slate-300 rounded-lg px-4 py-3 text-[16px] focus:ring-2 focus:ring-slate-500 outline-none"
            value={answers.praeteritum}
            onChange={e => setAnswers({...answers, praeteritum: e.target.value})}
            onKeyDown={handleKeyDown}
            placeholder="e.g. blieb"
            disabled={feedback !== null}
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Perfekt (er/sie/es)</label>
          <input 
            type="text" 
            className="w-full border border-slate-300 rounded-lg px-4 py-3 text-[16px] focus:ring-2 focus:ring-slate-500 outline-none"
            value={answers.perfekt}
            onChange={e => setAnswers({...answers, perfekt: e.target.value})}
            onKeyDown={handleKeyDown}
            placeholder="e.g. ist geblieben"
            disabled={feedback !== null}
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 text-center">Welche Ablautreihe ist das?</label>
          <div className="grid grid-cols-3 gap-2">
            {PATTERNS.map(p => {
               const c = COLORS[p.id];
               const isSelected = answers.pattern === p.vowels;
               return (
                <button
                  key={p.id}
                  onClick={() => setAnswers({...answers, pattern: p.vowels})}
                  disabled={feedback !== null}
                  className={`py-2 px-1 rounded-lg border text-[11px] sm:text-sm font-medium touch-manipulation transition-colors ${
                    isSelected ? `${c.bg} ${c.border} ${c.text}` : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p.vowels}
                </button>
              );
            })}
          </div>
        </div>

        {!feedback ? (
          <button 
            onClick={checkAnswers}
            className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl mt-4 text-base shadow-md touch-manipulation"
          >
            Lösung überprüfen
          </button>
        ) : (
          <button 
            onClick={loadRandomVerb}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl mt-4 text-base shadow-md touch-manipulation"
          >
            Nächste Frage
          </button>
        )}

        {feedback && (
          <div className={`mt-6 p-5 rounded-xl border ${feedback.status === 'correct' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} fade-in`}>
            <h3 className={`text-xl font-bold mb-1 text-center ${feedback.status === 'correct' ? 'text-emerald-800' : 'text-rose-800'}`}>
              {feedback.msg}
            </h3>
            
            {feedback.status === 'incorrect' && (
              <div className="text-center text-rose-700 text-sm font-medium mb-2">
                Korrekt: {feedback.correctPraet}, {feedback.correctPerfekt} <br/>
                Muster: {feedback.correctPattern}
              </div>
            )}

            <GrammarFeedbackBlock verb={currentVerb} />
          </div>
        )}
      </div>
    </div>
  );
}

// --- CHALLENGE-MODUS COMPONENT ---
function ChallengeModus() {
  const [currentVerb, setCurrentVerb] = useState(null);
  const [seenVerbs, setSeenVerbs] = useState([]); // Memory state, no localStorage
  const [answers, setAnswers] = useState({ praesens: '', praeteritum: '', perfekt: '', pattern: '' });
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadNextVerb([]);
  }, []);

  const loadNextVerb = (currentSeenList) => {
    let pool = VERBS.filter(v => !currentSeenList.includes(v.infinitive));
    if (pool.length === 0) {
      pool = VERBS;
      setSeenVerbs([]);
    }
    const nextVerb = pool[Math.floor(Math.random() * pool.length)];
    
    setCurrentVerb(nextVerb);
    setAnswers({ praesens: '', praeteritum: '', perfekt: '', pattern: '' });
    setFeedback(null);
  };

  const checkAnswers = () => {
    const normalize = (str) => str.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizePattern = (str) => str.toLowerCase().replace(/[-\s]/g, '');

    const isPraesensCorrect = normalize(answers.praesens) === normalize(currentVerb.praesens);
    const isPraetCorrect = normalize(answers.praeteritum) === normalize(currentVerb.praeteritum);
    const isPerfektCorrect = normalize(answers.perfekt) === normalize(currentVerb.perfekt);
    const isPatternCorrect = normalizePattern(answers.pattern) === normalizePattern(currentVerb.pattern);

    const errors = [];
    if (!isPraesensCorrect) errors.push('Präsens');
    if (!isPraetCorrect) errors.push('Präteritum');
    if (!isPerfektCorrect) errors.push('Perfekt');
    if (!isPatternCorrect) errors.push('Muster');

    if (errors.length === 0) {
      setFeedback({ status: 'correct', msg: 'Perfekt! Flawless recall.' });
    } else {
      setFeedback({ 
        status: 'incorrect', 
        msg: `Fehler in: ${errors.join(', ')}`,
        correct: currentVerb
      });
    }

    if (!seenVerbs.includes(currentVerb.infinitive)) {
      setSeenVerbs([...seenVerbs, currentVerb.infinitive]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!feedback) checkAnswers();
      else loadNextVerb(seenVerbs);
    }
  };

  if (!currentVerb) return null;

  const vc = COLORS[currentVerb.id];

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-8 fade-in">
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
        <span className="flex items-center gap-1 text-slate-800 font-bold uppercase tracking-wider text-[10px] sm:text-sm">
          ⚔️ Challenge
        </span>
        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-semibold">
          Fortschritt: {seenVerbs.length} / {VERBS.length}
        </span>
      </div>

      <div className="text-center mb-8">
        <div className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Gesuchtes Verb</div>
        <h2 className={`text-4xl sm:text-5xl font-extrabold ${vc.text}`}>{currentVerb.infinitive}</h2>
        <p className="text-slate-500 mt-2 text-xs sm:text-sm">No hints. Pure memory.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Präsens (er/sie/es)</label>
          <input 
            type="text" 
            className="w-full border border-slate-300 rounded-lg px-4 py-3 text-[16px] focus:ring-2 focus:ring-slate-500 outline-none"
            value={answers.praesens}
            onChange={e => setAnswers({...answers, praesens: e.target.value})}
            onKeyDown={handleKeyDown}
            placeholder="e.g. bleibt"
            disabled={feedback !== null}
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Präteritum (er/sie/es)</label>
          <input 
            type="text" 
            className="w-full border border-slate-300 rounded-lg px-4 py-3 text-[16px] focus:ring-2 focus:ring-slate-500 outline-none"
            value={answers.praeteritum}
            onChange={e => setAnswers({...answers, praeteritum: e.target.value})}
            onKeyDown={handleKeyDown}
            placeholder="e.g. blieb"
            disabled={feedback !== null}
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Perfekt (er/sie/es)</label>
          <input 
            type="text" 
            className="w-full border border-slate-300 rounded-lg px-4 py-3 text-[16px] focus:ring-2 focus:ring-slate-500 outline-none"
            value={answers.perfekt}
            onChange={e => setAnswers({...answers, perfekt: e.target.value})}
            onKeyDown={handleKeyDown}
            placeholder="e.g. ist geblieben"
            disabled={feedback !== null}
          />
        </div>
      </div>

      <div className="mb-8 max-w-sm mx-auto">
        <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 text-center">Welche Ablautreihe? (Text Only)</label>
        <input 
          type="text" 
          className="w-full border border-slate-300 bg-slate-50 rounded-lg px-4 py-3 text-center text-[16px] focus:ring-2 focus:ring-slate-500 outline-none font-mono text-slate-800"
          value={answers.pattern}
          onChange={e => setAnswers({...answers, pattern: e.target.value})}
          onKeyDown={handleKeyDown}
          placeholder="e.g. e-a-o"
          disabled={feedback !== null}
        />
        <p className="text-[10px] sm:text-xs text-slate-400 text-center mt-2">Type the vowels, e.g. "a-u-a" or "aua". Spacing is ignored.</p>
      </div>

      {!feedback ? (
        <button 
          onClick={checkAnswers}
          className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl text-base shadow-md touch-manipulation"
        >
          Lösung überprüfen
        </button>
      ) : (
        <button 
          onClick={() => loadNextVerb(seenVerbs)}
          className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base shadow-md touch-manipulation"
        >
          Nächste Herausforderung
        </button>
      )}

      {feedback && (
        <div className="mt-8 fade-in">
          {feedback.status === 'incorrect' && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 mb-4">
              <h3 className="text-lg font-bold text-rose-800 mb-4">{feedback.msg}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm text-rose-900 bg-white p-4 rounded-lg shadow-inner border border-rose-100">
                <div><strong className="block text-rose-400 text-[10px] uppercase">Präsens</strong> {feedback.correct.praesens}</div>
                <div><strong className="block text-rose-400 text-[10px] uppercase">Präteritum</strong> {feedback.correct.praeteritum}</div>
                <div><strong className="block text-rose-400 text-[10px] uppercase">Perfekt</strong> {feedback.correct.perfekt}</div>
                <div><strong className="block text-rose-400 text-[10px] uppercase">Muster</strong> {feedback.correct.pattern}</div>
              </div>
            </div>
          )}
          {feedback.status === 'correct' && (
             <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 text-center text-emerald-800 font-bold text-lg">
                {feedback.msg}
             </div>
          )}
          <GrammarFeedbackBlock verb={currentVerb} />
        </div>
      )}
    </div>
  );
}

// --- SCANNER MODUS COMPONENT ---
function ScannerModus({ onNavigate }) {
  const [searchInput, setSearchInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSearch = async () => {
    const input = searchInput.toLowerCase().trim();
    if (!input) return;

    setResult(null);
    setErrorMsg(null);
    setLoading(true);

    // Verified conjugation/pattern for verbs we already know. The AI occasionally
    // mislabels the Ablautreihe (e.g. stehen → a-u-a instead of e-a-a), so we still
    // ask the AI (for meaning/synonyms/antonyms) but OVERRIDE the pattern & forms
    // with this verified data below.
    const verified = getVerified(input);

    // Key comes from the environment: set VITE_GEMINI_API_KEY in app/.env.local (dev)
    // and in Vercel > Project Settings > Environment Variables (production).
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      // No key: still show the verified conjugation/pattern if we know the verb.
      if (verified) setResult(verified);
      else setErrorMsg("No API key configured. Add VITE_GEMINI_API_KEY in Vercel's Environment Variables (or app/.env.local for local dev) and redeploy.");
      setLoading(false);
      return;
    }

    const prompt = `You are a precise German morphology expert. Analyze the verb: "${input}".

Step 1 — Give the 3rd person singular (er/sie/es) for Präsens, Präteritum and Perfekt, with the correct auxiliary (haben/sein).
Step 2 — Determine the Ablautreihe STRICTLY from the three STEM VOWELS, in this exact order: [infinitive stem vowel] - [Präteritum stem vowel] - [Partizip II stem vowel]. Read each stem vowel directly off the principal parts you just produced (ignore prefixes such as ge-, be-, ver-, ent-, and any separable prefix).
Step 3 — Match those three vowels to EXACTLY one of these 9 patterns:
1: ei-ie-ie, 2: ei-i-i, 3: ie-o-o, 4: i-a-u, 5: e-a-o, 6: e-a-e, 7: a-u-a, 8: a-ie-a, 9: e-a-a.

CRITICAL RULE: the "pattern" you output MUST equal the three stem vowels you actually extracted — never approximate or guess by analogy to another verb.
Worked examples:
- stehen → stem vowels of stehen / stand / gestanden = e, a, a → pattern "e-a-a" → Reihe 9. (It is NOT a-u-a.)
- fahren → fahren / fuhr / gefahren = a, u, a → "a-u-a" → Reihe 7.
- nehmen → nehmen / nahm / genommen = e, a, o → "e-a-o" → Reihe 5.

If the verb does NOT fit any of the 9 patterns (e.g. gehen, sein, tun, or a regular/weak verb), output success:false, reihe:0, pattern:"Unknown".
In "msg" (short, English), state the three stem vowels you used and confirm they match the pattern.

ALWAYS also provide (regardless of the pattern), to help the learner build a semantic web:
- "meaning": the primary English meaning of the verb, concise.
- "synonyms": exactly 2 common German synonyms, each as an object {de, en} where en is a short English gloss.
- "antonyms": exactly 2 German antonyms (opposites), each as {de, en}. If no true opposite exists, give the closest contrasting verb.`;

    // Build the request once; only the model in the URL changes on fallback.
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        // No thinkingConfig: Gemini 3.x models reject thinkingBudget:0 (400). We let
        // the model think and just skip the "thought" part when parsing the JSON.
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            success: {type: "BOOLEAN"},
            infinitive: {type: "STRING"},
            praesens: {type: "STRING"},
            praeteritum: {type: "STRING"},
            perfekt: {type: "STRING"},
            pattern: {type: "STRING"},
            reihe: {type: "INTEGER"},
            meaning: {type: "STRING"},
            synonyms: {type: "ARRAY", items: {type: "OBJECT", properties: {de: {type: "STRING"}, en: {type: "STRING"}}, propertyOrdering: ["de","en"]}},
            antonyms: {type: "ARRAY", items: {type: "OBJECT", properties: {de: {type: "STRING"}, en: {type: "STRING"}}, propertyOrdering: ["de","en"]}},
            msg: {type: "STRING"}
          },
          propertyOrdering: ["success","infinitive","praesens","praeteritum","perfekt","pattern","reihe","meaning","synonyms","antonyms","msg"]
        }
      }
    };
    // Current -latest aliases (Gemini 3.x): always available to new keys. Pinned 2.5
    // models return 404 "no longer available to new users" for newer projects.
    const MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest'];
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let lastErr = null;

    try {
      let data = null;
      for (let m = 0; m < MODELS.length && !data; m++) {
        for (let attempt = 0; attempt < 2 && !data; attempt++) {
          const controller = new AbortController();
          const to = setTimeout(() => controller.abort(), 30000);
          try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS[m]}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify(requestBody),
            });
            clearTimeout(to);
            if (response.ok) {
              const jsonResponse = await response.json();
              const cands = jsonResponse.candidates || [];
              if (!cands.length) throw Object.assign(new Error('empty'), { retryable: true });
              const parts = (cands[0].content && cands[0].content.parts) || [];
              const textResult = (parts.find(p => p.text && !p.thought) || {}).text;
              if (!textResult) throw Object.assign(new Error('empty'), { retryable: true });
              data = JSON.parse(textResult);
              break;
            }
            let detail = `HTTP ${response.status}`;
            try { const e = await response.json(); detail = e?.error?.message || detail; } catch (_) {}
            const err = new Error(detail);
            err.status = response.status;
            if (response.status === 400 || response.status === 403) throw err; // bad key/request → don't retry
            err.retryable = true; // 429 / 500 / 503 → retry & fall back
            lastErr = err;
          } catch (err) {
            clearTimeout(to);
            if (err.status === 400 || err.status === 403) throw err;
            lastErr = err.name === 'AbortError'
              ? Object.assign(new Error('timeout'), { timeout: true })
              : err;
          }
          if (!data && attempt === 0) await sleep(1000 + Math.random() * 600);
        }
        if (!data && m < MODELS.length - 1) await sleep(500);
      }

      if (!data) throw (lastErr || new Error('unavailable'));
      // Keep the AI's semantics (meaning/synonyms/antonyms) but override the
      // accuracy-critical conjugation & pattern with the verified table when known.
      if (verified) {
        data = { ...data, success: true, infinitive: verified.infinitive,
          praesens: verified.praesens, praeteritum: verified.praeteritum, perfekt: verified.perfekt,
          pattern: verified.pattern, reihe: verified.reihe, exception: verified.exception, msg: verified.msg };
      }
      setResult(data);
    } catch (error) {
      // If the AI failed but we know the verb, still show its verified conjugation.
      if (verified) {
        setResult({ ...verified, msg: verified.msg + " (Meaning & synonyms are unavailable right now — the AI was busy.)" });
        setLoading(false);
        return;
      }
      let msg;
      if (error.timeout) msg = "The AI engine took too long to respond. Please tap Search again.";
      else if (error.status === 400 && /api[_ ]?key/i.test(error.message || '')) msg = "Invalid API key. Check VITE_GEMINI_API_KEY in Vercel and redeploy.";
      else if (error.status === 429) msg = "Usage limit reached on your Gemini key — please wait a bit and try again.";
      else if (error.status === 503 || /overload|high demand|unavailable/i.test(error.message || '')) msg = "The AI servers were briefly busy. Please tap Search once more.";
      else msg = "Could not analyze this verb: " + (error.message || "unknown error") + (error.status ? ` (status ${error.status})` : '');
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-8 fade-in">
       <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] sm:text-xs font-bold tracking-widest uppercase mb-2">
          🌐 Live AI Engine
        </span>
        <h2 className="text-3xl font-extrabold text-slate-800">Verb-Scanner</h2>
        <p className="text-slate-500 mt-2 text-xs sm:text-sm">
          Connected to Gemini API. Enter any of your 250+ irregular verbs to analyze its Master Pattern.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <input 
          type="text" 
          className="flex-1 border border-slate-300 rounded-lg px-4 py-3 text-[16px] focus:ring-2 focus:ring-blue-500 outline-none"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. gelten, empfehlen, unterbrechen..."
          disabled={loading}
        />
        <button 
          onClick={handleSearch}
          disabled={loading}
          className={`bg-blue-600 text-white font-bold px-5 rounded-lg transition-colors shadow-sm touch-manipulation ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
        >
          Search
        </button>
      </div>

      {loading && (
        <div className="text-center py-8 fade-in">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-slate-500 font-medium">AI is analyzing verb morphology...</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-6 text-center bg-red-50 text-red-800 rounded-xl border border-red-200 fade-in">
            <p className="font-bold text-lg mb-2">Connection Error</p>
            <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      {result && !loading && (
        <div className="fade-in border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {result.success && result.reihe >= 1 && result.reihe <= 9 ? (() => {
            const c = COLORS[result.reihe];
            const guideVerb = PATTERNS[result.reihe - 1].guide;
            return (
              <>
                <div className={`${c.bg} p-6 text-center border-b ${c.border}`}>
                  <h3 className={`text-3xl font-bold ${c.text}`}>{result.infinitive}</h3>
                </div>
                <div className="p-6 text-center bg-white">
                    <div className="grid grid-cols-3 gap-2 mb-6 text-sm">
                        <div><span className="block text-[10px] text-slate-400 uppercase font-bold">Präsens</span><span className="font-bold text-slate-800">{result.praesens}</span></div>
                        <div><span className="block text-[10px] text-slate-400 uppercase font-bold">Präteritum</span><span className="font-bold text-slate-800">{result.praeteritum}</span></div>
                        <div><span className="block text-[10px] text-slate-400 uppercase font-bold">Perfekt</span><span className="font-bold text-slate-800">{result.perfekt}</span></div>
                    </div>
                    <p className="text-slate-500 mb-2 text-xs font-bold uppercase tracking-widest">Detected Master Pattern</p>
                    <div className={`text-4xl font-extrabold ${c.text} mb-2`}>{result.pattern}</div>
                    {result.exception ? (
                      <p className="text-sm text-amber-700 mb-4">⚠ Exception — closest to the <strong>{guideVerb}</strong> pattern (Reihe {result.reihe}), but the Präteritum vowel is a short <strong>i</strong>, not <strong>ie</strong>.</p>
                    ) : (
                      <p className="text-sm text-slate-600 mb-4">Matches exactly the <strong>{guideVerb}</strong> pattern (Reihe {result.reihe}).</p>
                    )}
                    <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm text-left mb-4 shadow-inner">{result.msg}</div>
                    <SemanticInfo result={result} />
                    <button
                      onClick={() => onNavigate(guideVerb, result.reihe)}
                      className={`w-full ${c.bg} border ${c.border} ${c.text} font-bold py-4 rounded-xl text-base shadow-sm hover:opacity-90 touch-manipulation`}
                    >
                      View Master Table in Lernmodus
                    </button>
                    <a
                      href={`https://www.verbformen.com/conjugation/?w=${encodeURIComponent(result.infinitive || searchInput)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      📖 Full conjugation &amp; meaning on Verbformen ↗
                    </a>
                </div>
              </>
            );
          })() : (
            <>
              <div className="bg-slate-100 p-5 text-center border-b border-slate-200">
                <h3 className="text-2xl font-bold text-slate-800">{searchInput}</h3>
              </div>
              <div className="p-6 text-center bg-white">
                  <p className="font-bold text-slate-800 text-xl text-red-600 mb-2">Pattern Unbekannt</p>
                  <p className="text-slate-600 text-sm bg-red-50 p-4 rounded-lg">{result.msg || "This verb is either regular or highly irregular (like 'gehen' or 'sein') and does not match the 9 patterns."}</p>
                  <SemanticInfo result={result} />
                  <a
                    href={`https://www.verbformen.com/conjugation/?w=${encodeURIComponent(result.infinitive || searchInput)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    📖 Full conjugation &amp; meaning on Verbformen ↗
                  </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Meaning + 2 synonyms + 2 antonyms (from the AI) — builds a semantic web around
// the verb to aid memorization. Shown for every scanned verb.
function SemanticInfo({ result }) {
  const syn = Array.isArray(result.synonyms) ? result.synonyms.filter(s => s && s.de) : [];
  const ant = Array.isArray(result.antonyms) ? result.antonyms.filter(a => a && a.de) : [];
  if (!result.meaning && syn.length === 0 && ant.length === 0) return null;
  return (
    <div className="mt-4 mb-2 text-left">
      {result.meaning && (
        <div className="mb-3 text-center">
          <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Meaning</span>
          <span className="text-slate-800 font-semibold text-base">{result.meaning}</span>
        </div>
      )}
      {(syn.length > 0 || ant.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {syn.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-[10px] uppercase font-bold text-emerald-700 tracking-wide mb-1.5">≈ Synonyms</div>
              <ul className="space-y-1">
                {syn.slice(0, 2).map((s, i) => (
                  <li key={i} className="text-sm leading-snug"><span className="font-bold text-emerald-900">{s.de}</span>{s.en ? <span className="text-emerald-700"> — {s.en}</span> : null}</li>
                ))}
              </ul>
            </div>
          )}
          {ant.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
              <div className="text-[10px] uppercase font-bold text-rose-700 tracking-wide mb-1.5">↔ Antonyms</div>
              <ul className="space-y-1">
                {ant.slice(0, 2).map((a, i) => (
                  <li key={i} className="text-sm leading-snug"><span className="font-bold text-rose-900">{a.de}</span>{a.en ? <span className="text-rose-700"> — {a.en}</span> : null}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- SHARED FEEDBACK COMPONENT ---
function GrammarFeedbackBlock({ verb }) {
  const sisterVerbs = VERBS.filter(v => v.pattern === verb.pattern && v.infinitive !== verb.infinitive).map(v => v.infinitive).join(', ');
  const c = COLORS[verb.id];

  return (
    <div className="mt-6 bg-white border border-slate-200 rounded-lg p-4 sm:p-5 text-left text-xs sm:text-sm text-slate-700 shadow-sm">
      <h4 className={`font-bold ${c.text} flex items-center gap-2 mb-3 border-b pb-2 text-base`}>
        💡 English Grammar Insights
      </h4>
      
      {verb.primaryUmlaut && (
        <div className="mb-4">
          <strong className="text-slate-900 block mb-1">Historical Primary Umlaut:</strong>
          In Old High German, an "i" or "j" in the 2nd and 3rd person singular endings pulled the root vowel "a" forward in the mouth, creating an "ä". This explains the vowel change in the present tense (e.g. fahren -&gt; fährt).
        </div>
      )}
      
      {verb.vowelShift && (
        <div className="mb-4">
          <strong className="text-slate-900 block mb-1">Vowel Shift (e/i-Wechsel):</strong>
          Historically, an "i" in the ending of the 2nd and 3rd person singular caused the root vowel "e" to rise and become an "i" or "ie" (e.g. helfen -&gt; hilft). 
        </div>
      )}

      {verb.consonantShift && (
        <div className="mb-4 bg-amber-50 p-3 rounded border border-amber-200">
          <strong className="text-amber-900 block mb-1">Consonant Shift (Grammatischer Wechsel):</strong>
          Notice the consonant change?
          <ul className="list-disc pl-5 mt-1 space-y-1">
            {verb.consonantShift === 'd-tt' && <li><strong>d -&gt; tt:</strong> The long vowel shortens, so the consonant "d" doubles to a hard "tt" to mark this short vowel.</li>}
            {verb.consonantShift === 'h-g' && <li><strong>h -&gt; g:</strong> A historical voicing of the consonant due to Verner's Law, changing the breathy "h" to a hard "g".</li>}
          </ul>
        </div>
      )}

      {verb.inseparable && (
        <div className="mb-4 bg-purple-50 p-3 rounded border border-purple-200">
          <strong className="text-purple-900 block mb-1">Inseparable Prefix:</strong>
          This verb has an inseparable prefix (be-, ver-, ent-, etc). Because the stress remains on the root verb, it <strong>drops the "ge-" prefix</strong> in the Perfekt tense.
        </div>
      )}

      <div className={`${c.bg} p-3 rounded border ${c.border} mt-2`}>
        <strong className={`${c.text} block mb-1`}>Associative Memory Network:</strong>
        This verb follows the color-coded <strong>{verb.pattern}</strong> pattern. To anchor this in your brain, remember that it behaves exactly like its sister verbs: 
        <span className="block mt-1 font-mono font-bold text-slate-800">{sisterVerbs || 'No other verbs in this group yet.'}</span>
      </div>

      <a
        href={`https://www.verbformen.com/conjugation/?w=${encodeURIComponent(verb.infinitive)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
      >
        📖 Full conjugation &amp; meaning of “{verb.infinitive}” on Verbformen ↗
      </a>
    </div>
  );
}