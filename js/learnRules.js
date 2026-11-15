// Rules that keep learning meaningful (2026-11-15, from the family's logs):
// a lesson replayed after it was mastered earns no XP and doesn't count as
// learning time, a weak lesson is worth redoing, a video has to be watched
// before its quiz, and a think course's level follows how the last rounds went.
// Pure functions, so the app, the tests and the coach mirror stay in step.

export const MASTERED = 90; // best accuracy from which a replay is just a repeat
export const WEAK = 60;     // below this a done lesson is marked for practice
export const WATCH_SHARE = 0.85; // share of a video that must really play before its quiz

// What a round of this lesson is, given its progress record (null = never done).
// Practice rounds (tp-*) are new questions every time, so they always count.
export function repeatKind(lessonId, prev) {
  if (String(lessonId).startsWith('tp-')) return 'new';
  if (!prev || prev.status !== 'done' || prev.skipped || !(prev.times_done > 0)) return 'new';
  const best = Number(prev.best_accuracy) || 0;
  if (best >= MASTERED) return 'mastered';
  if (best < WEAK) return 'weak';
  return 'review';
}

// XP for a finished round. New: full. Mastered repeat: none. A weak or
// half-known lesson: full when the score improved, otherwise half.
export function roundXp(kind, xp, accuracy, prevBest = 0) {
  if (kind === 'new') return xp;
  if (kind === 'mastered') return 0;
  return accuracy > prevBest ? xp : Math.ceil(xp / 2);
}

// A think course's level from the latest rounds: three in a row at 90+ go up a
// level, three in a row under 50 go down one. `accs` is oldest first.
export function autoLevel(base, accs) {
  const last = (accs || []).filter((a) => typeof a === 'number').slice(-3);
  if (last.length < 3) return base;
  if (last.every((a) => a >= 90)) return Math.min(3, base + 1);
  if (last.every((a) => a < 50)) return Math.max(1, base - 1);
  return base;
}

// Where a course sits against the learner's school grade: 'above' when it
// starts more than one grade higher, 'below' when it ended more than one grade
// lower, else 'fit'. Adults (13) and learners without a grade fit everything.
export function gradeFit(course, grade) {
  const g = parseInt(grade, 10);
  if (!g || g >= 13 || !course.grades) return 'fit';
  const [lo, hi] = course.grades;
  if (lo > g + 1) return 'above';
  if (hi < g - 1) return 'below';
  return 'fit';
}

// Video watching: only time that really played counts, and on a first viewing
// the learner can't jump past what they have already seen.
export function watchTracker(duration) {
  let watched = 0;   // seconds actually played
  let furthest = 0;  // furthest point reached by playing
  let lastT = 0;
  return {
    // Called on timeupdate with the current position; a jump over 2 s is a seek, not play.
    tick(t) {
      const dt = t - lastT;
      if (dt > 0 && dt <= 2) { watched += dt; furthest = Math.max(furthest, t); }
      lastT = t;
    },
    seeked(t) { lastT = t; },
    furthest: () => furthest,
    watched: () => watched,
    enough: (len = duration) => !len || watched >= len * WATCH_SHARE,
  };
}
