import { store, newId } from './db.js';
import { localISO } from './dates.js';
import { computeStreak } from './streak.js';

export const PROFILE_ID = 'me';

export async function getProfile() {
  let p = await store.get('profiles', PROFILE_ID);
  if (!p) {
    p = { id: PROFILE_ID, name: '', daily_goal_xp: 10, created_at: new Date().toISOString() };
    await store.put('profiles', p);
  }
  return p;
}

export async function doneLessonIds() {
  const rows = await store.byIndex('progress', 'profile_id', PROFILE_ID);
  return rows.filter((r) => r.status === 'done').map((r) => r.lesson_id);
}

export async function stats() {
  const [profile, days] = await Promise.all([getProfile(), store.byIndex('days', 'profile_id', PROFILE_ID)]);
  const today = localISO();
  const todayRow = days.find((d) => d.date === today);
  return {
    totalXp: days.reduce((sum, d) => sum + d.xp, 0),
    todayXp: todayRow ? todayRow.xp : 0,
    goalXp: profile.daily_goal_xp,
    streak: computeStreak(days, today),
  };
}

// Saves a finished lesson. Returns { streakBefore, streakAfter, goalMetNow }.
export async function saveLessonResult({ lessonId, xp, accuracy, durationS, mistakes }) {
  const profile = await getProfile();
  const today = localISO();
  const before = await stats();

  await store.put('results', {
    id: newId(), profile_id: PROFILE_ID, lesson_id: lessonId, date: today,
    xp, accuracy, duration_s: durationS, mistakes,
  });

  const key = `${PROFILE_ID}:${lessonId}`;
  const prev = await store.get('progress', key);
  await store.put('progress', {
    id: key, profile_id: PROFILE_ID, lesson_id: lessonId, status: 'done',
    best_accuracy: Math.max(accuracy, prev ? prev.best_accuracy : 0),
    times_done: (prev ? prev.times_done : 0) + 1,
  });

  const dayKey = `${PROFILE_ID}:${today}`;
  const day = (await store.get('days', dayKey)) || { id: dayKey, profile_id: PROFILE_ID, date: today, xp: 0, goal_met: false, freeze_used: false };
  const wasMet = day.goal_met;
  day.xp += xp;
  day.goal_met = day.xp >= profile.daily_goal_xp;
  await store.put('days', day);

  const after = await stats();
  return { streakBefore: before.streak, streakAfter: after.streak, goalMetNow: !wasMet && day.goal_met };
}
