export const DAY_MS = 86400000;

export const srsKey = (level, topic) => `${level}::${topic}`;

export function splitKey(k) {
  const i = k.indexOf("::");
  return i < 0 ? { level: "?", topic: k } : { level: k.slice(0, i), topic: k.slice(i + 2) };
}

// quality: 1 = Wieder (failed), 3 = Schwer (hard pass), 5 = Gut (clean)
export function srsUpdate(prev, quality) {
  const now = Date.now();
  const p = prev || { ease: 2.5, interval: 0, repetitions: 0, successCount: 0, failCount: 0 };
  let { ease, interval, repetitions } = p;
  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions = (repetitions || 0) + 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.max(1, Math.round((interval || 1) * ease));
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  return {
    ease,
    interval,
    repetitions,
    lastReviewed: now,
    due: now + interval * DAY_MS,
    successCount: (p.successCount || 0) + (quality >= 3 ? 1 : 0),
    failCount:    (p.failCount    || 0) + (quality <  3 ? 1 : 0),
  };
}

export function dueIn(srs) { return srs && srs.due ? srs.due - Date.now() : null; }

export function dueLabel(ms) {
  if (ms == null) return null;
  const days = ms / DAY_MS;
  if (days <= 0) {
    const overdue = -days;
    if (overdue < 1) return "Fällig — heute";
    if (overdue < 2) return "1 Tag überfällig";
    return `${Math.floor(overdue)} Tage überfällig`;
  }
  if (days < 1) return "Heute fällig";
  if (days < 2) return "Morgen fällig";
  if (days < 7) return `In ${Math.ceil(days)} Tagen`;
  if (days < 30) return `In ${Math.ceil(days/7)} Wochen`;
  return `In ${Math.ceil(days/30)} Monaten`;
}
