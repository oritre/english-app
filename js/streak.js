import { addDays } from './dates.js';

// days: array of { date: 'YYYY-MM-DD', xp, goal_met, freeze_used }.
// The streak counts consecutive days with goal_met (or a freeze), ending today,
// or ending yesterday if today's lesson isn't done yet.
export function computeStreak(days, today) {
  const kept = new Set(days.filter((d) => d.goal_met || d.freeze_used).map((d) => d.date));
  let cursor = kept.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (kept.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function xpForLesson({ mistakes, total }) {
  const base = 10;
  const perfectBonus = mistakes === 0 ? 5 : 0;
  return base + perfectBonus + Math.min(5, Math.floor(total / 3));
}
