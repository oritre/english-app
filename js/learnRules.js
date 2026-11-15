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

// ---- the 20-minute round ----
// Each subject gets `quota` minutes of real learning per round. A subject that
// used its minutes closes (after the lesson in progress ends, never in the
// middle) until every other subject has had its minutes too; then a new round
// starts and everything is open again. Replays of mastered lessons don't count.
// `sessions` are the day's session records; `exempt` subjects have nothing new
// left to learn, so the round doesn't wait for them.
export function rotation(sessions, subjects, quota, exempt = []) {
  const need = subjects.filter((s) => !exempt.includes(s));
  const zero = () => Object.fromEntries(subjects.map((s) => [s, 0]));
  let used = zero();
  let rounds = 0;
  for (const x of [...sessions].sort((a, b) => (a.at || 0) - (b.at || 0))) {
    if (x.repeat === 'mastered' || !(x.subject in used)) continue;
    used[x.subject] += (x.active_s || 0) / 60;
    if (need.length > 1 && need.every((k) => used[k] >= quota)) { used = zero(); rounds++; }
  }
  const locked = need.length > 1 ? need.filter((k) => used[k] >= quota) : [];
  return { quota, used, locked, need, rounds, waiting: need.filter((k) => used[k] < quota) };
}

// ---- guessing ----
export const GUESS_STOP = 2; // guesses in a lesson before it stops to explain again
// A round is guess-y when 3+ answers were guesses, or 2+ and a quarter of the questions.
// It earns half the XP, never counts as mastered, and pulls the course level down.
export const guessyRound = (guesses, total) => guesses >= 3 || (guesses >= 2 && guesses / Math.max(1, total) >= 0.25);
export const GUESSY_CAP = WEAK - 1;

// ---- what a learner may open (ori, 2026-11-15) ----
// Nothing above the learner's school grade: a course that starts above the
// grade stays closed unless the weekly review opened it for this learner (it is
// in the subject's plan, or listed in profile.unlock_courses as 'subject:id').
export function aboveGrade(course, grade) {
  const g = parseInt(grade, 10);
  if (!g || g >= 13 || !course?.grades) return false;
  return course.grades[0] > g;
}
export function courseOpen(course, profile, subject) {
  if (!aboveGrade(course, profile?.grade)) return true;
  const plan = profile?.[`${subject}_plan`]?.courses || [];
  const unlocked = profile?.unlock_courses || [];
  return plan.includes(course.id) || unlocked.includes(`${subject}:${course.id}`);
}
export const subjectOfLesson = (id) => (/^tp?-/.test(id) ? 'think' : id.startsWith('k-') ? 'know' : id.startsWith('p-') ? 'parasha' : 'english');

// A mastered lesson may be repeated once (without XP), then it closes: the next
// lesson is waiting. Records from before this rule count 3+ rounds as that one repeat.
export function masteredRepeats(prev) {
  if (!prev) return 0;
  if (prev.mastered_repeats != null) return prev.mastered_repeats;
  return (prev.times_done || 0) >= 3 ? 1 : 0;
}
export const repeatClosed = (lessonId, prev) => repeatKind(lessonId, prev) === 'mastered' && masteredRepeats(prev) >= 1;
