export function todayStr() { return new Date().toISOString().slice(0, 10); }

export function bumpStreak(state) {
  const today = todayStr();
  const last = state.streak.lastDate;
  if (last === today) return state;
  let current = 1;
  if (last) {
    const d = new Date(today) - new Date(last);
    if (d <= 1000 * 60 * 60 * 24 * 1.5) current = state.streak.current + 1;
  }
  return { ...state, streak: { current, longest: Math.max(current, state.streak.longest), lastDate: today } };
}
