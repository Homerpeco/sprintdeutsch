import { CONTEXT_PRESETS } from './storage.js';

export function detectPreset(text) {
  for (const k of Object.keys(CONTEXT_PRESETS)) {
    if ((CONTEXT_PRESETS[k] || "") === (text || "")) return k;
  }
  return "custom";
}

export function buildLearnPrompt(level, topic, contextBlock) {
  const parts = [
    `Teach me the German grammar topic "${topic}" at ${level} level.`,
    "",
    "What I need:",
    "1. A clear English explanation of the structural mechanics (no German prose explaining grammar).",
    "2. 3 example sentences in German, each followed by its English translation on the same line (em-dash separator).",
    "3. 2 common mistakes English speakers make on this topic.",
    "4. End with one short produce-it task: ask me to write one sentence using this structure.",
  ];
  if (contextBlock && contextBlock.trim()) {
    parts.push("", contextBlock);
  }
  parts.push("", "Ground your explanation in the retrieved grammar excerpts from my PDF library when relevant; cite source + page.");
  return parts.join("\n");
}

export function buildQuizPrompt(level, topic, contextBlock) {
  const parts = [
    `Quiz me on the German grammar topic "${topic}" at ${level} level.`,
    "",
    "QUIZ FORMAT:",
    "1. Ask 5 questions, one at a time. Wait for my answer before sending the next question.",
    "2. Test the STRUCTURAL MECHANICS of this topic — endings, word order, case selection, form pairs — not just vocabulary.",
    "3. After each of my answers: corrected German sentence in bold WITH its English translation, then one English sentence explaining what rule was tested.",
    "4. After question 5, give a one-paragraph summary in English of what I should review.",
  ];
  if (contextBlock && contextBlock.trim()) {
    parts.push("", "QUESTION SOURCING:", contextBlock);
  }
  parts.push(
    "",
    "Ground your questions in the German grammar excerpts retrieved from my PDF library. If retrieval is empty or off-topic, say so in one short line and proceed from your own knowledge.",
    "",
    "Start with question 1."
  );
  return parts.join("\n");
}
