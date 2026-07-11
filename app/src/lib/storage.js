export const CONTEXT_PRESETS = {
  manufacturing: [
    "Use professional vocabulary in example sentences — pick whichever fits each grammar point most naturally, and rotate across the response:",
    "  • Data science: algorithms, machine learning, neural networks, feature engineering, model training",
    "  • Supply-chain optimization: inventory, lead time, throughput, bottleneck, logistics, demand forecasting",
    "  • Manufacturing — injection molding (Spritzgießen): Werkzeug, Zykluszeit, Kunststoffgranulat, Wartung, Ausschuss"
  ].join("\n"),

  academic: [
    "Use vocabulary from academic / thesis-writing contexts in example sentences — pick whichever fits each grammar point most naturally:",
    "  • Research methodology: Hypothese, Stichprobe, Untersuchung, Befund, Variable, Kontrollgruppe",
    "  • Argumentation: These, Begründung, Gegenargument, Erörterung, Schlussfolgerung",
    "  • Academic writing: Quellenangabe, Zitat, Paraphrase, Literaturverzeichnis, Diskussion"
  ].join("\n"),

  software: [
    "Use vocabulary from software development contexts in example sentences — pick whichever fits each grammar point most naturally:",
    "  • Programming: Funktion, Variable, Schleife, Datenstruktur, Algorithmus, Fehler, Bibliothek",
    "  • Engineering practice: Code-Review, Testabdeckung, Refaktorisierung, Versionskontrolle, Dokumentation",
    "  • System design: Architektur, Skalierbarkeit, Latenz, Datenbankzugriff, Sicherheit, Bereitstellung"
  ].join("\n"),

  none: "",
};

export const CONTEXT_PRESET_LABELS = {
  manufacturing: "Manufacturing / DS / Supply-chain",
  academic: "Academic thesis writing",
  software: "Software development",
  none: "No domain context",
};

export const STORE_KEY = "sprintdeutsch_v1";

export function loadState() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch { return {}; }
}

export function saveState(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }

// Deployed AI-Tutor backend (Render). localhost only works during local dev,
// so stored localhost values are migrated to the deployed URL; anything else
// the user typed in Settings is respected.
export const DEFAULT_BACKEND_URL = "https://sprintdeutsch-backend.onrender.com";

export function initialState() {
  const stored = loadState();
  const backendUrl = (stored.backendUrl && !/^https?:\/\/localhost/.test(stored.backendUrl))
    ? stored.backendUrl
    : DEFAULT_BACKEND_URL;
  return {
    level: stored.level || "B1",
    backendUrl,
    provider: stored.provider || "gemini",
    contextDomain: stored.contextDomain != null ? stored.contextDomain : CONTEXT_PRESETS.manufacturing,
    apiKey: stored.apiKey || "",
    verbsKnown: stored.verbsKnown || {},
    grammarSeen: stored.grammarSeen || {},
    srs: stored.srs || {},
    verbMatrixSrs: stored.verbMatrixSrs || {},
    practice: stored.practice || { speaking:0, writing:0, reading:0, listening:0 },
    streak: stored.streak || { current:0, longest:0, lastDate:null },
    sessions: stored.sessions || 0,
    tutorPersona: stored.tutorPersona || "default",
  };
}
