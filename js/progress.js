import { store, newId } from './db.js';
import { localISO, addDays } from './dates.js';
import { weekStart, weekEnd, buildBoard, nextTier, TIERS } from './league.js';
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

// ---- leagues ----

async function weekXp(profileId, weekId) {
  const end = addDays(weekId, 7);
  const days = await store.byIndex('days', 'profile_id', profileId);
  return days.filter((d) => d.date >= weekId && d.date < end).reduce((s, d) => s + d.xp, 0);
}

async function realMembers(profiles, weekId, tier) {
  const rows = [];
  for (const p of profiles) {
    if (!p.league || p.league.week !== weekId || p.league.tier !== tier) continue;
    const xp = await weekXp(p.id, weekId);
    if (xp > 0) rows.push({ id: p.id, name: p.name, avatar: p.avatar, xp });
  }
  return rows;
}

// Closes any finished week: ranks each learner on that week's final board and
// moves them up or down a tier. Weeks with no XP leave the tier as it was.
export async function settleLeagues(now = new Date()) {
  const thisWeek = weekStart(now);
  const profiles = await listProfiles();
  const updates = [];
  for (const p of profiles) {
    if (!p.league) { p.league = { tier: 0, week: thisWeek }; updates.push(p); continue; }
    if (p.league.week === thisWeek) continue;
    const old = p.league;
    const real = await realMembers(profiles, old.week, old.tier);
    const mine = real.find((r) => r.id === p.id);
    if (mine) {
      const board = buildBoard(old.week, old.tier, real, weekEnd(old.week) - 1);
      const row = board.find((r) => r.id === p.id);
      p.last_result = { week: old.week, tier: old.tier, rank: row.rank, zone: row.zone, seen: false };
      p.league = { tier: nextTier(old.tier, row.zone), week: thisWeek };
    } else {
      p.league = { tier: old.tier, week: thisWeek };
    }
    updates.push(p);
  }
  for (const p of updates) await store.put('profiles', p);
}

export async function leagueView(now = new Date()) {
  await settleLeagues(now);
  const profiles = await listProfiles();
  const me = profiles.find((p) => p.id === currentId);
  const { tier, week } = me.league;
  const real = await realMembers(profiles, week, tier);
  const board = buildBoard(week, tier, real, now.getTime());
  return { tier: TIERS[tier], week, board, myRow: board.find((r) => r.id === me.id) || null, lastResult: me.last_result, profile: me };
}

export async function markResultSeen() {
  const p = await getProfile();
  if (p.last_result) { p.last_result.seen = true; await store.put('profiles', p); }
}

// One row per answer: what kind of exercise, right or wrong, how long it took.
// The progress report is built from these.
export async function logAttempt({ lessonId, exercise, outcome, ms, source = 'lesson', given = null, expected = null, taps = [], pos = null, lessonSec = null, sid = null }) {
  if (!currentId) return;
  await store.put('attempts', {
    id: newId(), profile_id: currentId, lesson_id: lessonId, exercise_id: exercise.id,
    type: exercise.type, lang: exercise.lang || null, outcome, ms: Math.round(ms), source,
    date: localISO(), at: Date.now(), hour: new Date().getHours(),
    given, expected, taps, pos, lesson_sec: lessonSec, sid,
  });
}

// A spoken conversation: kept with the attempts (so it syncs) but apart from exercise stats.
export async function logTalk({ topic, sec, transcript }) {
  if (!currentId) return;
  await store.put('attempts', {
    id: newId(), profile_id: currentId, lesson_id: 'talk', exercise_id: `talk-${topic}`, type: 'talk', source: 'talk',
    outcome: 'talk', ms: sec * 1000, date: localISO(), at: Date.now(), hour: new Date().getHours(),
    topic, transcript: transcript.slice(0, 200).map((t) => ({ who: t.who, text: t.text.slice(0, 600) })),
  });
}

export async function reportData(profileId) {
  const [profile, attempts, results, days, progress] = await Promise.all([
    store.get('profiles', profileId),
    store.byIndex('attempts', 'profile_id', profileId),
    store.byIndex('results', 'profile_id', profileId),
    store.byIndex('days', 'profile_id', profileId),
    store.byIndex('progress', 'profile_id', profileId),
  ]);
  return {
    profile, attempts: attempts.filter((a) => a.type !== 'talk' && a.type !== 'session'),
    talks: attempts.filter((a) => a.type === 'talk'), sessions: attempts.filter((a) => a.type === 'session'), results, days, progress,
  };
}

// After pulling from other devices, rebuild each day's XP from the lesson
// results (each result is its own record, so nothing is lost when two devices
// learned on the same day; a day record alone would be last-write-wins).
export async function rebuildDays() {
  const profiles = await store.all('profiles');
  for (const p of profiles) {
    const results = await store.byIndex('results', 'profile_id', p.id);
    const days = await store.byIndex('days', 'profile_id', p.id);
    const byDate = new Map();
    for (const r of results) byDate.set(r.date, (byDate.get(r.date) || 0) + r.xp);
    for (const [date, xp] of byDate) {
      const id = `${p.id}:${date}`;
      const old = days.find((d) => d.id === id);
      const goal_met = xp >= p.daily_goal_xp;
      if (old && old.xp === xp && old.goal_met === goal_met) continue;
      await store.put('days', { id, profile_id: p.id, date, xp, goal_met, freeze_used: old ? old.freeze_used : false });
    }
  }
}
