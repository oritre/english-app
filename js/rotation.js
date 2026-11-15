// The day's 20-minute round for the current learner (see learnRules.rotation).
// Kids only (grade 1-12); profile.rotation_min changes the minutes, 0 turns it off.
import { store } from './db.js';
import { localISO } from './dates.js';
import { SUBJECTS, subjectOf } from './insights.js';
import { rotation, gradeFit } from './learnRules.js';
import { loadKnow } from './course.js';
import { doneLessonIds } from './progress.js';

export const DEFAULT_ROUND_MIN = 20;

export function roundMinutes(profile) {
  if (profile?.rotation_min != null) return Number(profile.rotation_min) || 0;
  const g = parseInt(profile?.grade, 10);
  return g >= 1 && g <= 12 ? DEFAULT_ROUND_MIN : 0;
}

// A subject with nothing new left doesn't hold the round: general knowledge once
// every video for the grade was watched, and the weekly parasha (one film a week)
// once this week's films are done.
async function exhausted(profile) {
  const out = [];
  let d = new Set();
  try { d = new Set(await doneLessonIds()); } catch { return out; }
  try {
    const know = await loadKnow();
    const ids = (know.courses || []).filter((c) => gradeFit(c, profile.grade) !== 'below').flatMap((c) => c.units.flatMap((u) => u.lessons));
    if (ids.length && ids.every((id) => d.has(id))) out.push('know');
  } catch { /* no catalog */ }
  try {
    const r = await fetch('data/parasha.json');
    const ids = r.ok ? [...new Set((await r.text()).match(/"p-[a-z0-9-]+"/g) || [])].map((x) => x.slice(1, -1)) : [];
    if (!ids.length || ids.every((id) => d.has(id))) out.push('parasha');
  } catch { out.push('parasha'); }
  return out;
}

export async function roundNow(profile) {
  const quota = roundMinutes(profile);
  if (!quota || !profile?.id) return null;
  const today = localISO();
  const rows = (await store.byIndex('attempts', 'profile_id', profile.id))
    .filter((a) => a.type === 'session' && a.date === today)
    .map((a) => ({ ...a, subject: a.subject || subjectOf(a.lesson_id) }));
  return rotation(rows, SUBJECTS.map((s) => s.id), quota, await exhausted(profile));
}

export const isLocked = (round, lessonId) => !!round && round.locked.includes(subjectOf(lessonId));
