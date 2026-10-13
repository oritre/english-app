import { store, newId } from './db.js';
import { localISO } from './dates.js';
import { computeStreak } from './streak.js';

// Several learners can share one device. The chosen one is remembered per
// device; storage can be blocked (private mode), so fall back to memory.
const CURRENT_KEY = 'english_app_current_profile';
let currentId = null;
try { currentId = localStorage.getItem(CURRENT_KEY); } catch { /* storage blocked */ }

export function currentProfileId() { return currentId; }

export function setCurrentProfile(id) {
  currentId = id;
  try { id ? localStorage.setItem(CURRENT_KEY, id) : localStorage.removeItem(CURRENT_KEY); } catch { /* storage blocked */ }
}

export async function listProfiles() {
  const all = await store.all('profiles');
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getProfile(id = currentId) {
  return id ? store.get('profiles', id) : null;
}

export async function createProfile({ name, avatar, dailyGoalXp }) {
  const p = {
    id: newId(), name, avatar, daily_goal_xp: dailyGoalXp,
    start_choice: null, placement: null, created_at: new Date().toISOString(),
  };
  await store.put('profiles', p);
  return p;
}

export async function updateProfile(p) { await store.put('profiles', p); }

export async function doneLessonIds() {
  const rows = await store.byIndex('progress', 'profile_id', currentId);
  return rows.filter((r) => r.status === 'done').map((r) => r.lesson_id);
}

// Marks lessons as passed by the placement test. Never un-does real progress,
// so retaking the test and scoring lower keeps what was already learned.
export async function markSkipped(lessonIds) {
  for (const lessonId of lessonIds) {
    const key = `${currentId}:${lessonId}`;
    if (await store.get('progress', key)) continue;
    await store.put('progress', {
      id: key, profile_id: currentId, lesson_id: lessonId, status: 'done',
      skipped: true, best_accuracy: 0, times_done: 0,
    });
  }
}

export async function stats() {
  const [profile, days] = await Promise.all([getProfile(), store.byIndex('days', 'profile_id', currentId)]);
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
    id: newId(), profile_id: currentId, lesson_id: lessonId, date: today,
    xp, accuracy, duration_s: durationS, mistakes,
  });

  const key = `${currentId}:${lessonId}`;
  const prev = await store.get('progress', key);
  await store.put('progress', {
    id: key, profile_id: currentId, lesson_id: lessonId, status: 'done', skipped: false,
    best_accuracy: Math.max(accuracy, prev ? prev.best_accuracy : 0),
    times_done: (prev ? prev.times_done : 0) + 1,
  });

  const dayKey = `${currentId}:${today}`;
  const day = (await store.get('days', dayKey)) || { id: dayKey, profile_id: currentId, date: today, xp: 0, goal_met: false, freeze_used: false };
  const wasMet = day.goal_met;
  day.xp += xp;
  day.goal_met = day.xp >= profile.daily_goal_xp;
  await store.put('days', day);

  const after = await stats();
  return { streakBefore: before.streak, streakAfter: after.streak, goalMetNow: !wasMet && day.goal_met };
}
