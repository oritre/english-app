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
