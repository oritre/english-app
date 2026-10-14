// Turns a learner's raw answers into the progress report: time spent, skills,
// hardest items and suggestions. Pure functions, unit tested.
import { addDays } from './dates.js';

export const SKILLS = [
  { id: 'vocab', name: 'אוצר מילים', types: ['choose', 'match_pairs'] },
  { id: 'to_en', name: 'תרגום לאנגלית', types: ['translate_he_en'] },
  { id: 'from_en', name: 'הבנת משפטים באנגלית', types: ['translate_en_he'] },
  { id: 'grammar', name: 'דקדוק', types: ['fill_blank'] },
  { id: 'listening', name: 'הקשבה', types: ['listen_type', 'listen_translate'] },
  { id: 'speaking', name: 'דיבור', types: ['speak'] },
  { id: 'reading', name: 'הבנת הנקרא', types: ['read'] },
  { id: 'abc', name: 'אותיות וצלילים', types: ['pick', 'spell'] },
];
const MIN_FOR_VERDICT = 5;

const isRight = (a) => a.outcome === 'correct' || a.outcome === 'typo';
const answered = (a) => a.outcome !== 'skipped';

export function skillStats(attempts) {
  return SKILLS.map((skill) => {
    const rows = attempts.filter((a) => skill.types.includes(a.type));
    const done = rows.filter(answered);
    const right = done.filter(isRight).length;
    const firstTry = done.filter((a) => a.outcome === 'correct').length;
    const secs = done.map((a) => a.ms / 1000).sort((x, y) => x - y);
    return {
      ...skill,
      count: done.length,
      skipped: rows.length - done.length,
      typos: done.filter((a) => a.outcome === 'typo').length,
      accuracy: done.length ? right / done.length : null,
      firstTry: done.length ? firstTry / done.length : null,
      medianSec: secs.length ? secs[Math.floor(secs.length / 2)] : null,
      enough: done.length >= MIN_FOR_VERDICT,
    };
  });
}

export function minutesByDay(results, today, days = 14) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const secs = results.filter((r) => r.date === date).reduce((s, r) => s + r.duration_s, 0);
    out.push({ date, minutes: Math.round((secs / 60) * 10) / 10, lessons: results.filter((r) => r.date === date).length });
  }
  return out;
}

export function hardestItems(attempts, limit = 5) {
  const byId = new Map();
  for (const a of attempts.filter(answered)) {
    const row = byId.get(a.exercise_id) || { exercise_id: a.exercise_id, lesson_id: a.lesson_id, type: a.type, wrong: 0, total: 0 };
    row.total++;
    if (!isRight(a)) row.wrong++;
    byId.set(a.exercise_id, row);
  }
  return [...byId.values()].filter((r) => r.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || b.wrong / b.total - a.wrong / a.total).slice(0, limit);
}

export function summarize({ profile, attempts, results, days, progress }, today) {
  const totalSec = results.reduce((s, r) => s + r.duration_s, 0);
  const lessonsDone = progress.filter((p) => p.status === 'done' && !p.skipped).length;
  const skipped = progress.filter((p) => p.skipped).length;
  const last7 = new Set(results.filter((r) => r.date > addDays(today, -7)).map((r) => r.date)).size;
  const last14 = new Set(results.filter((r) => r.date > addDays(today, -14)).map((r) => r.date)).size;
  const goalDays7 = days.filter((d) => d.date > addDays(today, -7) && d.goal_met).length;
  const answeredAll = attempts.filter(answered);
  const accuracy = answeredAll.length ? answeredAll.filter(isRight).length / answeredAll.length : null;
  const avgLessonMin = results.length ? totalSec / results.length / 60 : null;
  const weakLessons = progress.filter((p) => p.status === 'done' && !p.skipped && p.best_accuracy < 70).map((p) => p.lesson_id);
  const startDate = (profile.created_at || '').slice(0, 10) || today;
  const daysSinceStart = Math.round((new Date(today) - new Date(startDate)) / 86400e3);
  return {
    daysSinceStart,
    totalMinutes: Math.round(totalSec / 60), lessonsDone, skipped, sessions: results.length,
    activeDays7: last7, activeDays14: last14, goalDays7, accuracy, avgLessonMin,
    totalXp: days.reduce((s, d) => s + d.xp, 0), weakLessons, goalXp: profile.daily_goal_xp,
  };
}

const TIPS = {
  vocab: 'לחזור על המילים של השיעורים האחרונים. בתרגילי ההתאמה כדאי להגיד כל מילה בקול לפני הלחיצה.',
  to_en: 'לשים לב לסדר המילים באנגלית (נושא, פועל ואז השאר) ולמילים הקטנות a, the, is ו־am, שאין להן מקבילה בעברית.',
  from_en: 'לקרוא את המשפט באנגלית בקול לפני התרגום, ולחפש קודם את הפועל.',
  grammar: 'לקרוא את ההסבר שמופיע אחרי טעות. ההסברים קצרים ומכוונים בדיוק לכלל שהתבלבל בו.',
  listening: 'להשתמש בכפתור הצב (השמעה איטית) ולהקשיב פעמיים לפני שעונים.',
  abc: 'לחזור על כרטיסי ההסבר של האותיות שמתבלבלים בהן, ולהגיד כל צליל בקול לפני שבוחרים.',
  reading: 'לקרוא את הקטע פעם אחת עד הסוף לפני השאלות, ואז לחפש בו את המילים מהשאלה.',
  speaking: 'לתרגל במקום שקט, קרוב למיקרופון, ולהגיד את המשפט לאט ובבירור. אפשר קודם לשמוע אותו בכפתור הרמקול.',
};

// Rule-based suggestions, most useful first. Each has a tone: good, info or warn.
export function suggestions(sum, skills, titles = {}) {
  const out = [];
  if (sum.sessions === 0) return [{ tone: 'info', text: 'עוד אין שיעורים. אחרי שיעור או שניים יופיעו כאן נתונים והמלצות.' }];

  const rated = skills.filter((s) => s.enough);
  const weakest = rated.filter((s) => s.accuracy < 0.75).sort((a, b) => a.accuracy - b.accuracy)[0];
  const strongest = rated.filter((s) => s.accuracy >= 0.9).sort((a, b) => b.accuracy - a.accuracy)[0];
  if (weakest) out.push({ tone: 'warn', text: `${weakest.name} היא נקודת החולשה (${pct(weakest.accuracy)} הצלחה). ${TIPS[weakest.id]}` });
  if (strongest) out.push({ tone: 'good', text: `${strongest.name} הוא החוזק הבולט: ${pct(strongest.accuracy)} הצלחה.` });

  const speaking = skills.find((s) => s.id === 'speaking');
  if (speaking.skipped >= 3) out.push({ tone: 'warn', text: `היו ${speaking.skipped} דילוגים על תרגילי דיבור. דיבור הוא החלק שהכי קשה לתרגל לבד, וכדאי למצוא לו זמן קבוע ושקט.` });

  const typed = skills.find((s) => s.id === 'listening');
  if (typed.count >= MIN_FOR_VERDICT && typed.typos / typed.count >= 0.15) out.push({ tone: 'info', text: 'יש הרבה שגיאות כתיב קטנות בהקלדה. כדאי לשים לב לאיות של מילים שחוזרות.' });

  if (sum.daysSinceStart >= 6 && sum.activeDays7 < 3) out.push({ tone: 'warn', text: `רק ${sum.activeDays7} ${sum.activeDays7 === 1 ? 'יום לימוד' : 'ימי לימוד'} בשבוע האחרון. שיעור קצר כל יום עדיף על הרבה שיעורים פעם בשבוע. אפשר להוריד את היעד היומי או לקבוע שעה קבועה.` });
  else if (sum.goalDays7 >= 5 && sum.goalXp < 40) out.push({ tone: 'good', text: `היעד היומי הושג ${sum.goalDays7} ימים מתוך 7. אפשר להעלות את היעד.` });

  if (sum.accuracy >= 0.92 && sum.sessions >= 3 && sum.avgLessonMin < 5) out.push({ tone: 'info', text: 'הצלחה מהירה ובדיוק גבוה. כדאי לנסות שוב את מבחן הרמה ולקפוץ קדימה.' });
  if (sum.weakLessons.length) out.push({ tone: 'info', text: `כדאי לחזור על: ${sum.weakLessons.slice(0, 3).map((id) => `"${titles[id] || id}"`).join(', ')}. הדיוק הכי טוב שם עדיין מתחת ל־70%.` });
  if (!out.length) out.push({ tone: 'good', text: 'התקדמות יפה ומאוזנת. להמשיך ככה!' });
  return out;
}

export const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
