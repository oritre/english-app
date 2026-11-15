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

// General knowledge can run out (every video for the grade watched); then the round doesn't wait for it.
async function exhausted(profile) {
  try {
    const [know, done] = await Promise.all([loadKnow(), doneLessonIds()]);
    const d = new Set(done);
    const ids = (know.courses || []).filter((c) => gradeFit(c, profile.grade) !== 'below').flatMap((c) => c.units.flatMap((u) => u.lessons));
    return ids.length && ids.every((id) => d.has(id)) ? ['know'] : [];
  } catch { return []; }
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
