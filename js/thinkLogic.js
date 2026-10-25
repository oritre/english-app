// Checking for the think exercises. Pure functions, no DOM, so they run under node tests too.

// "3/4", "0.75", "-2" -> a number; null when it isn't one.
export function parseNum(s) {
  const t = String(s ?? '').trim().replace(/\s+/g, '').replace(',', '.');
  if (!t) return null;
  const frac = t.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  return /^-?\d+(?:\.\d+)?$/.test(t) ? Number(t) : null;
}

// Same value counts, so 6/8 is right where 3/4 is asked, unless the exercise
// asks for an exact form (exact: true, e.g. "write it with 8 parts").
export function sameNumber(given, answer, { exact = false } = {}) {
  if (exact) return String(given).replace(/\s+/g, '') === String(answer).replace(/\s+/g, '');
  const a = parseNum(given);
  const b = parseNum(answer);
  return a != null && b != null && Math.abs(a - b) < 1e-9;
}

export const MOVES = { up: [0, -1, '⬆️'], down: [0, 1, '⬇️'], left: [-1, 0, '⬅️'], right: [1, 0, '➡️'] };

// Runs a program on a grid ("#" wall, "R" start, "*" goal). A repeat tile
// ("x2", "x3") does the command before it that many times in all.
// Returns the path walked and whether it ended on the goal without crashing.
export function runRobot(grid, program) {
  const rows = grid.map((r) => [...r]);
  let x = 0, y = 0, gx = 0, gy = 0;
  rows.forEach((r, j) => r.forEach((c, i) => { if (c === 'R') { x = i; y = j; } if (c === '*') { gx = i; gy = j; } }));
  const steps = [];
  for (let k = 0; k < program.length; k++) {
    const t = program[k];
    const rep = /^x(\d)$/.exec(t);
    const cmd = rep ? program[k - 1] : t;
    if (!MOVES[cmd]) continue;
    for (let n = 0; n < (rep ? Number(rep[1]) - 1 : 1); n++) {
      const [dx, dy] = MOVES[cmd];
      const nx = x + dx, ny = y + dy;
      if (ny < 0 || ny >= rows.length || nx < 0 || nx >= rows[ny].length || rows[ny][nx] === '#') {
        steps.push({ x, y, crash: true });
        return { steps, ok: false, crash: true };
      }
      x = nx; y = ny;
      steps.push({ x, y });
    }
  }
  return { steps, ok: x === gx && y === gy, crash: false };
}

// A learner's level in a course: 1 basic, 2 advanced, 3 challenge. The weekly
// review sets it from measured accuracy (profile.think_level = {course: n});
// until then it follows where the school grade sits in the course's grade band.
export const LEVEL_NAMES = ['', 'בסיס', 'מתקדם', 'אתגר'];
export function courseLevel(course, profile) {
  const set = Number(profile?.think_level?.[course.id]);
  if (set >= 1 && set <= 3) return { level: set, measured: true };
  const g = parseInt(profile?.grade, 10);
  const [lo, hi] = course.grades || [1, 13];
  if (!g || g <= lo) return { level: 1, measured: false };
  if (g > hi) return { level: 3, measured: false };
  const t = (g - lo) / Math.max(1, hi - lo);
  return { level: t < 1 / 3 ? 1 : t < 2 / 3 ? 2 : 3, measured: false };
}

// How many leading units the learner may skip (they stay open as optional
// review): what the weekly review measured, or one unit when the course is
// below the learner's grade.
export function skipUnits(course, profile) {
  const { level, measured } = courseLevel(course, profile);
  const g = parseInt(profile?.grade, 10);
  const want = measured ? level - 1 : g > (course.grades || [1, 13])[1] ? 1 : 0;
  return Math.max(0, Math.min(want, course.units.length - 1));
}

// The lessons a learner still has to do in order, after any skipped units.
export function requiredLessons(course, profile) {
  return course.units.slice(skipUnits(course, profile)).flatMap((u) => u.lessons);
}
