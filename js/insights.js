// The parent view: how much each learner really worked in each tab, how well,
// and whether the goals the parent set were met. Pure functions, unit tested
// (tests/logic.test.mjs); tools/coach.py and the Pi's goal notifier mirror the
// same rules in Python.
import { addDays } from './dates.js';
import { weekStart } from './league.js';

export const SUBJECTS = [
  { id: 'english', icon: '🔤', name: 'אנגלית' },
  { id: 'think', icon: '🧠', name: 'חשיבה ומדעים' },
  { id: 'know', icon: '🌍', name: 'ידע כללי' },
];

// Lesson ids: k-… general knowledge, t-… / tp-… (practice) thinking, the rest English
// (units, ABC, unseens, the weekly coach and the spoken tutor).
export function subjectOf(lessonId) {
  const id = String(lessonId || '');
  if (id.startsWith('k-')) return 'know';
  if (/^tp?-/.test(id)) return 'think';
  return 'english';
}

const isoDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };

// period: 'day' (today), 'week' (Sunday to Saturday, like the league), 'lastweek'.
export function periodRange(period, today) {
  if (period === 'day') return { from: today, to: today };
  const from = weekStart(isoDate(today));
  if (period === 'lastweek') return { from: addDays(from, -7), to: addDays(from, -1) };
  return { from, to: addDays(from, 6) };
}

// The same stretch just before, for trends.
export function previousRange({ from, to }) {
  const len = Math.round((isoDate(to) - isoDate(from)) / 86400e3) + 1;
  return { from: addDays(from, -len), to: addDays(from, -1) };
}

const RIGHT = new Set(['correct', 'typo']);
const CHOICE = new Set(['choose', 'pick', 'mcq', 'fill_blank', 'match_pairs', 'order', 'buckets']);
const TYPED = new Set(['translate_he_en', 'translate_en_he', 'listen_type', 'listen_translate', 'spell', 'speak']);
// A wrong answer faster than this can't have been read and thought about.
export function guessMs(type) { return type === 'read' ? 3000 : CHOICE.has(type) ? 1500 : 1200; }

// One answer is a guess when it is wrong and too fast to have been thought
// through, or when it is a choice question where 3+ cards were tried.
export function isGuess(a) {
  if (TYPED.has(a.type) || a.outcome === 'skipped') return false;
  if (a.outcome === 'wrong' && a.ms < guessMs(a.type)) return true;
  return (a.taps || []).filter((t) => t.k === 'choice').length >= 3;
}

const inRange = (r, { from, to }) => r.date >= from && r.date <= to;
const forSubject = (subject) => (r) => subject === 'all' || subjectOf(r.lesson_id) === subject;

// data: { attempts (answers only), sessions, results } of one learner.
export function insights(data, range, subject = 'all') {
  const pick = (rows) => (rows || []).filter((r) => inRange(r, range) && forSubject(subject)(r));
  const sessions = pick(data.sessions);
  const answers = pick(data.attempts).filter((a) => a.outcome !== 'skipped');
  const results = pick(data.results);

  const activeS = sessions.reduce((s, x) => s + (x.active_s || 0), 0);
  const openS = sessions.reduce((s, x) => s + (x.open_s || 0), 0);
  const quit = sessions.filter((x) => !x.finished && x.lesson_id !== 'talk' && (x.active_s || 0) >= 30).length;

  // Each exercise seen in one sitting: was it right the first time, and if not, was it fixed?
  const groups = new Map();
  for (const a of [...answers].sort((x, y) => x.at - y.at)) {
    const key = `${a.sid || a.date}|${a.lesson_id}|${a.exercise_id}`;
    const g = groups.get(key) || [];
    g.push(a.outcome);
    groups.set(key, g);
  }
  const items = [...groups.values()];
  const firstRight = items.filter((g) => RIGHT.has(g[0])).length;
  const missed = items.filter((g) => !RIGHT.has(g[0]));
  const fixed = missed.filter((g) => g.some((o) => RIGHT.has(o) || o === 'retry')).length;
  const guesses = answers.filter(isGuess).length;

  // Lessons: first completion of a lesson ever, a repeat, or a round of endless practice.
  const firstDone = new Map();
  for (const r of [...(data.results || [])].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))) {
    if (!firstDone.has(r.lesson_id)) firstDone.set(r.lesson_id, r.id);
  }
  const practice = results.filter((r) => String(r.lesson_id).startsWith('tp-'));
  const fresh = results.filter((r) => !String(r.lesson_id).startsWith('tp-') && firstDone.get(r.lesson_id) === r.id);
  const lessonAcc = results.map((r) => r.accuracy).filter((x) => typeof x === 'number');

  const out = {
    activeMin: activeS / 60, openMin: openS / 60,
    focus: openS >= 60 ? activeS / openS : null,
    sittings: sessions.length, quit,
    answers: answers.length, items: items.length,
    firstTry: items.length ? firstRight / items.length : null,
    fixRate: missed.length ? fixed / missed.length : null,
    guessShare: answers.length ? guesses / answers.length : null,
    newLessons: fresh.length, mastered: fresh.filter((r) => r.accuracy >= 80).length,
    repeats: results.length - fresh.length - practice.length, practice: practice.length,
    lessonAccuracy: lessonAcc.length ? lessonAcc.reduce((s, x) => s + x, 0) / lessonAcc.length / 100 : null,
    days: new Set([...sessions, ...results].map((r) => r.date)).size,
  };
  out.progress = out.newLessons + out.practice;
  out.quality = qualityScore(out);
  return out;
}

// 0–100. Mostly first-try accuracy, then not guessing, staying focused, and fixing mistakes.
export const MIN_FOR_QUALITY = 8;
export function qualityScore(x) {
  if (x.items < MIN_FOR_QUALITY) return null;
  const parts = [[x.firstTry, 0.45], [x.guessShare == null ? null : 1 - x.guessShare, 0.25], [x.focus, 0.15], [x.fixRate ?? 1, 0.15]]
    .filter(([v]) => v != null);
  const w = parts.reduce((s, [, k]) => s + k, 0);
  return Math.round((100 * parts.reduce((s, [v, k]) => s + v * k, 0)) / w);
}

export const GOAL_KINDS = {
  minutes: { name: 'דקות למידה פעילה', unit: "דק'", value: (x) => Math.round(x.activeMin) },
  lessons: { name: 'שיעורים חדשים או סבבי תרגול', unit: 'שיעורים', value: (x) => x.progress },
  quality: { name: 'ציון איכות', unit: 'מתוך 100', value: (x) => x.quality },
};

// goals: [{ id, kind, subject: 'all'|'english'|'think'|'know', target, period: 'day'|'week' }]
// state: 'met', 'open' (period still running) or 'missed'.
// `day` picks the period; `today` decides whether it is over.
export function goalStatus(goal, data, day, today = day) {
  const range = periodRange(goal.period, day);
  const x = insights(data, range, goal.subject || 'all');
  const actual = GOAL_KINDS[goal.kind].value(x);
  const met = actual != null && actual >= goal.target;
  const over = range.to < today;
  return { goal, range, actual, met, share: actual == null ? 0 : Math.min(1, actual / goal.target), state: met ? 'met' : over ? 'missed' : 'open' };
}

// For the previous day / week of each goal: was it met?
export function lastPeriodStatus(goal, data, today) {
  const prevToday = goal.period === 'day' ? addDays(today, -1) : addDays(periodRange('week', today).from, -1);
  return goalStatus(goal, data, prevToday, today);
}

export function goalLabel(goal) {
  const k = GOAL_KINDS[goal.kind];
  const subj = goal.subject && goal.subject !== 'all' ? SUBJECTS.find((s) => s.id === goal.subject) : null;
  const per = goal.period === 'day' ? 'ביום' : 'בשבוע';
  if (goal.kind === 'quality') return `ציון איכות ${goal.target} לפחות ${per}${subj ? ` ב${subj.name}` : ''}`;
  return `${goal.target} ${k.unit} ${per}${subj ? ` ב${subj.name}` : ''}`;
}
