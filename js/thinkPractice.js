// Endless practice for a think course: fresh problems with new numbers each
// time, mixed with a few exercises reviewed from the course's own lessons.
// Pure (no DOM), so the tests can solve every generated problem.

const pick = (r, a) => a[Math.floor(r() * a.length)];
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const N = (prompt_he, answer, explain_he, extra = {}) => ({ type: 'number', prompt_he, answer: String(answer), explain_he, ...extra });
const MC = (prompt_he, answer, wrong, explain_he) => ({ type: 'mcq', prompt_he, answer: String(answer), options: [String(answer), ...[...new Set(wrong.map(String))].filter((w) => w !== String(answer)).slice(0, 3)], explain_he });
const NL = (prompt_he, min, max, step, answer, explain_he) => ({ type: 'numberline', prompt_he, min, max, step, answer: String(answer), explain_he });
const near = (r, x, d = 3) => [x + int(r, 1, d), x - int(r, 1, d), x + int(r, d + 1, d * 3)];
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const dec = (x) => String(Math.round(x * 100) / 100);
const signed = (x) => (x < 0 ? `(${x})` : String(x));

// Each generator returns one problem; a course draws from its list at random.
export const GENERATORS = {
  counting: [
    (r) => { const a = int(r, 1, 10), b = int(r, 1, 10); return N(`${a} + ${b} = ?`, a + b, `סופרים ${b} קדימה מ-${a}: ${a + b}.`); },
    (r) => { const a = int(r, 6, 20), b = int(r, 1, a); return N(`${a} − ${b} = ?`, a - b, `סופרים ${b} אחורה מ-${a}: ${a - b}.`); },
    (r) => { const n = int(r, 2, 6), icon = pick(r, ['🍎', '⭐', '🐟', '🎈']); return N(`כמה יש? ${icon.repeat(n)} ועוד ${icon.repeat(2)}`, n + 2, `${n} ועוד 2 זה ${n + 2}.`); },
  ],
  placevalue: [
    (r) => { const n = int(r, 101, 999); return N(`כמה עשרות יש במספר ${n}? (רק ספרת העשרות)`, Math.floor(n / 10) % 10, `ב-${n}: ${Math.floor(n / 100)} מאות, ${Math.floor(n / 10) % 10} עשרות, ${n % 10} אחדות.`); },
    (r) => { const h = int(r, 1, 9), t = int(r, 0, 9), o = int(r, 0, 9); return N(`${h} מאות, ${t} עשרות ו-${o} אחדות. איזה מספר זה?`, h * 100 + t * 10 + o, `${h * 100} + ${t * 10} + ${o} = ${h * 100 + t * 10 + o}.`); },
    (r) => { const n = int(r, 100, 889); return N(`מה המספר שגדול ב-10 מ-${n}?`, n + 10, `מוסיפים עשרת אחת: ${n} + 10 = ${n + 10}.`); },
  ],
  times: [
    (r) => { const a = int(r, 2, 10), b = int(r, 2, 10); return N(`${a} × ${b} = ?`, a * b, `${a} קבוצות של ${b}: ${a * b}.`); },
    (r) => { const a = int(r, 2, 10), b = int(r, 2, 10); return N(`${a * b} : ${a} = ?`, b, `${a} × ${b} = ${a * b}, אז ${a * b} : ${a} = ${b}.`); },
    (r) => { const a = int(r, 2, 9), b = int(r, 2, 9); return N(`ב-${a} קופסאות יש ${b} עפרונות בכל אחת. כמה עפרונות בסך הכול?`, a * b, `${a} × ${b} = ${a * b}.`); },
  ],
  algebra: [
    (r) => { const x = int(r, 1, 12), a = int(r, 1, 15); return N(`x + ${a} = ${x + a}. כמה זה x?`, x, `מורידים ${a} משני הצדדים: x = ${x}.`); },
    (r) => { const x = int(r, 1, 10), a = int(r, 2, 6); return N(`${a}x = ${a * x}. כמה זה x?`, x, `מחלקים את שני הצדדים ב-${a}: x = ${x}.`); },
    (r) => { const x = int(r, 1, 9), a = int(r, 2, 5), b = int(r, 1, 12); return N(`${a}x + ${b} = ${a * x + b}. כמה זה x?`, x, `מורידים ${b}: ${a}x = ${a * x}. מחלקים ב-${a}: x = ${x}.`); },
  ],
  fractions: [
    (r) => { const parts = pick(r, [2, 3, 4, 5, 6, 8]), k = int(r, 1, parts - 1); return { type: 'fraction', prompt_he: `צבעו ${k}/${parts} מהצורה`, parts, answer: `${k}/${parts}`, explain_he: `מחלקים ל-${parts} חלקים שווים וצובעים ${k}.` }; },
    (r) => { const d = pick(r, [2, 3, 4, 5]), m = int(r, 2, 6); return N(`כמה זה 1/${d} מ-${d * m}?`, m, `${d * m} : ${d} = ${m}.`); },
    (r) => { const d = pick(r, [4, 5, 8, 10]), a = int(r, 1, d - 2), b = int(r, 1, d - 1 - a); return N(`${a}/${d} + ${b}/${d} = ?/${d}. מה המונה?`, a + b, `כשהמכנה זהה, מחברים רק את המונים: ${a} + ${b} = ${a + b}.`); },
  ],
  patterns: [
    (r) => { const s = int(r, 1, 20), d = int(r, 2, 9); const a = [0, 1, 2, 3].map((i) => s + i * d); return N(`${a.join(', ')}, ? מה המספר הבא?`, s + 4 * d, `כל פעם מוסיפים ${d}: ${a[3]} + ${d} = ${s + 4 * d}.`); },
    (r) => { const s = int(r, 1, 3), q = pick(r, [2, 3]); const a = [0, 1, 2, 3].map((i) => s * q ** i); return N(`${a.join(', ')}, ? מה המספר הבא?`, a[3] * q, `כל פעם כופלים ב-${q}: ${a[3]} × ${q} = ${a[3] * q}.`); },
    (r) => { const s = int(r, 40, 80), d = int(r, 3, 8); const a = [0, 1, 2, 3].map((i) => s - i * d); return N(`${a.join(', ')}, ? מה המספר הבא?`, s - 4 * d, `כל פעם מורידים ${d}: ${a[3]} − ${d} = ${s - 4 * d}.`); },
  ],
  numbers: [
    (r) => { const a = pick(r, [12, 18, 24, 30, 36, 42]), b = pick(r, [8, 16, 20, 27, 45]); return N(`מה המחלק המשותף הגדול ביותר של ${a} ו-${b}?`, gcd(a, b), `המספר הגדול ביותר שמחלק את שניהם: ${gcd(a, b)}.`); },
    (r) => { const p = pick(r, [11, 13, 17, 19, 23, 29, 31, 37]); const w = [15, 21, 27, 33, 39, 49, 51, 25].filter((x) => x !== p).sort(() => r() - 0.5); return MC('איזה מספר ראשוני (מתחלק רק ב-1 ובעצמו)?', p, w, `${p} לא מתחלק באף מספר מלבד 1 ו-${p}. השאר מתחלקים ב-3, 5 או 7.`); },
    (r) => { const a = pick(r, [4, 6, 8, 9, 10]), b = pick(r, [3, 5, 6, 12, 15]); const l = (a * b) / gcd(a, b); return N(`מה הכפולה המשותפת הקטנה ביותר של ${a} ו-${b}?`, l, `המספר הקטן ביותר ששניהם מחלקים: ${l}.`); },
  ],
  negatives: [
    (r) => { const a = int(r, -9, 9), b = int(r, -9, -1); return N(`${a} + ${signed(b)} = ?`, a + b, `מוסיפים מספר שלילי, כלומר זזים ${-b} שמאלה: ${a + b}.`, { negative: true }); },
    (r) => { const a = int(r, -5, 8), b = int(r, 3, 12); return N(`${a} − ${b} = ?`, a - b, `מ-${a} זזים ${b} שמאלה על ציר המספרים: ${a - b}.`, { negative: true }); },
    (r) => { const t = int(r, -6, 4), d = int(r, 2, 9); return N(`בבוקר היו ${t}°. בצהריים התחמם ב-${d}°. כמה מעלות עכשיו?`, t + d, `${t} + ${d} = ${t + d}.`, { negative: true }); },
  ],
  percents: [
    (r) => { const p = pick(r, [10, 20, 25, 50, 75]), n = pick(r, [20, 40, 60, 80, 120, 200]); return N(`כמה זה ${p}% מ-${n}?`, (p * n) / 100, `${p}% = ${p}/100, ו-${n} × ${p}/100 = ${(p * n) / 100}.`); },
    (r) => { const n = pick(r, [40, 80, 100, 120, 200]), p = pick(r, [10, 25, 50]); return N(`חולצה ב-${n} ₪ בהנחה של ${p}%. כמה משלמים?`, n - (n * p) / 100, `ההנחה היא ${(n * p) / 100} ₪, אז ${n} − ${(n * p) / 100} = ${n - (n * p) / 100}.`); },
    (r) => { const k = int(r, 1, 9), n = pick(r, [10, 20, 50]); return N(`${k * n / 10} מתוך ${n} הם כמה אחוזים?`, (k * 10), `${k * n / 10}/${n} = ${k * 10}/100 = ${k * 10}%.`); },
  ],
  decimals: [
    (r) => { const k = int(r, 1, 9); return NL(`סמנו את ${k / 10} על הציר`, 0, 1, 0.1, k / 10, `${k / 10} זה ${k} עשיריות: ${k} קפיצות של 0.1.`); },
    (r) => { const a = int(r, 1, 8) / 10, b = int(r, 1, 9) / 10; const s = Math.round((a + b) * 10) / 10; return MC(`${a} + ${b} = ?`, s, [dec(s + 0.1), dec(s - 0.1), dec(a * 10 + b * 10)], `מחברים עשיריות: ${a * 10} + ${b * 10} = ${Math.round(s * 10)} עשיריות, כלומר ${s}.`); },
    (r) => { const a = int(r, 11, 89), b = a + int(r, 1, 10); const [x, y] = r() < 0.5 ? [a, b] : [b, a]; return MC(`מי גדול יותר: ${x / 100} או ${y / 100}?`, b / 100, [a / 100], `משווים ספרה אחרי ספרה: ${b / 100} גדול יותר.`); },
  ],
  ratio: [
    (r) => { const a = int(r, 1, 5), b = int(r, 1, 5), k = int(r, 2, 6); return N(`היחס בין בנים לבנות הוא ${a}:${b}. יש ${a * k} בנים. כמה בנות?`, b * k, `כל ${a} בנים יש ${b} בנות. ${a * k} : ${a} = ${k}, ו-${k} × ${b} = ${b * k}.`); },
    (r) => { const p = int(r, 2, 9), n = int(r, 2, 6), m = int(r, n + 1, 10); return N(`${n} מחברות עולות ${p * n} ₪. כמה עולות ${m} מחברות?`, p * m, `מחברת אחת עולה ${p} ₪, אז ${m} × ${p} = ${p * m}.`); },
  ],
  coordinates: [
    (r) => { const x = int(r, -5, 5), y = int(r, -5, 5), d = int(r, 1, 4); return N(`הנקודה (${x}, ${y}) זזה ${d} ימינה. מה ה-x החדש?`, x + d, `ימינה מגדיל את x: ${x} + ${d} = ${x + d}.`, { negative: x + d < 0 }); },
    (r) => { const x = pick(r, [1, -1]) * int(r, 1, 6), y = pick(r, [1, -1]) * int(r, 1, 6); const q = x > 0 ? (y > 0 ? 'רביע I' : 'רביע IV') : (y > 0 ? 'רביע II' : 'רביע III'); return MC(`באיזה רביע נמצאת הנקודה (${x}, ${y})?`, q, ['רביע I', 'רביע II', 'רביע III', 'רביע IV'], `x ${x > 0 ? 'חיובי' : 'שלילי'} ו-y ${y > 0 ? 'חיובי' : 'שלילי'}: ${q}.`); },
  ],
  volume: [
    (r) => { const a = int(r, 2, 6), b = int(r, 2, 5), c = int(r, 2, 5); return N(`קופסה ${a} × ${b} × ${c}. מה הנפח?`, a * b * c, `${a} × ${b} = ${a * b} בכל שכבה, ו-${c} שכבות: ${a * b * c}.`); },
    (r) => { const a = int(r, 2, 12), b = int(r, 2, 9); return N(`מלבן ${a} על ${b}. מה השטח?`, a * b, `שטח = אורך × רוחב = ${a * b}.`); },
    (r) => { const a = int(r, 2, 12), b = int(r, 2, 9); return N(`מלבן ${a} על ${b}. מה ההיקף?`, 2 * (a + b), `היקף = ${a} + ${b} + ${a} + ${b} = ${2 * (a + b)}.`); },
  ],
  exponents: [
    (r) => { const b = int(r, 2, 5), e = int(r, 2, b === 2 ? 6 : 3); return N(`${b}^${e} = ?`, b ** e, `${b} כפול עצמו ${e} פעמים: ${b ** e}.`); },
    (r) => { const e1 = int(r, 2, 5), e2 = int(r, 2, 5); return N(`2^${e1} × 2^${e2} = 2^?`, e1 + e2, `כשכופלים חזקות עם אותו בסיס, מחברים מעריכים: ${e1} + ${e2} = ${e1 + e2}.`); },
  ],
  linear: [
    (r) => { const m = int(r, -3, 4) || 2, b = int(r, -5, 6), x = int(r, -3, 5); return N(`y = ${m}x ${b < 0 ? '−' : '+'} ${Math.abs(b)}. כמה זה y כש-x = ${x}?`, m * x + b, `${m} × ${signed(x)} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${m * x + b}.`, { negative: true }); },
    (r) => { const m = int(r, 1, 5), b = int(r, -4, 6), x1 = int(r, 0, 3), x2 = x1 + int(r, 1, 3); return N(`הישר עובר ב-(${x1}, ${m * x1 + b}) וב-(${x2}, ${m * x2 + b}). מה השיפוע?`, m, `השיפוע = שינוי ב-y חלקי שינוי ב-x: ${m * (x2 - x1)} : ${x2 - x1} = ${m}.`); },
  ],
  functions: [
    (r) => { const a = int(r, 2, 5), b = int(r, 1, 9), x = int(r, 1, 6); return N(`f(x) = ${a}x + ${b}. מה f(${x})?`, a * x + b, `מציבים ${x}: ${a} × ${x} + ${b} = ${a * x + b}.`); },
    (r) => { const x = int(r, 2, 9); return N(`f(x) = x². מה f(${x})?`, x * x, `${x} × ${x} = ${x * x}.`); },
  ],
  pythagoras: [
    (r) => { const [a, b, c] = pick(r, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17]]); return N(`במשולש ישר זווית הניצבים ${a} ו-${b}. מה אורך היתר?`, c, `${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c}, והשורש הוא ${c}.`); },
    (r) => { const [a, b, c] = pick(r, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [12, 16, 20]]); return N(`היתר ${c} וניצב אחד ${a}. מה אורך הניצב השני?`, b, `${c}² − ${a}² = ${c * c} − ${a * a} = ${b * b}, והשורש הוא ${b}.`); },
  ],
  stats: [
    (r) => { const m = int(r, 3, 9), d = [int(r, 1, 3), int(r, 0, 2)]; const xs = [m - d[0], m, m + d[0], m - d[1], m + d[1]].sort(() => r() - 0.5); return N(`מה הממוצע של ${xs.join(', ')}?`, m, `הסכום ${xs.reduce((s, x) => s + x, 0)} חלקי 5 = ${m}.`); },
    (r) => { const xs = Array.from({ length: 5 }, () => int(r, 1, 20)); const s = [...xs].sort((a, b) => a - b); return N(`מה החציון של ${xs.join(', ')}?`, s[2], `מסדרים: ${s.join(', ')}. האמצעי הוא ${s[2]}.`); },
  ],
  geometry: [
    (r) => { const a = int(r, 3, 11) * 10, b = int(r, 2, 15 - a / 10) * 10; return N(`במשולש שתי זוויות: ${a}° ו-${b}°. מה הזווית השלישית?`, 180 - a - b, `סכום הזוויות במשולש 180°: 180 − ${a} − ${b} = ${180 - a - b}.`); },
    (r) => { const a = int(r, 2, 16) * 10; return { type: 'angle', prompt_he: `בנו זווית של ${a}°`, answer: a, explain_he: `${a}° היא ${a < 90 ? 'זווית חדה' : a === 90 ? 'זווית ישרה' : 'זווית קהה'}.` }; },
  ],
  clock: [
    (r) => { const h = int(r, 1, 11), d = int(r, 1, 5); return N(`השעה ${h}:00. מה תהיה השעה בעוד ${d} שעות? (רק השעה)`, ((h + d - 1) % 12) + 1, `סופרים ${d} שעות קדימה מ-${h}.`); },
    (r) => { const m = pick(r, [15, 30, 45, 20, 40]); return N(`כמה דקות יש ב-${m === 30 ? 'חצי שעה' : m === 15 ? 'רבע שעה' : m === 45 ? 'שלושה רבעי שעה' : `${m / 60 * 3} שלישים של שעה`}?`, m, `בשעה 60 דקות, אז ${m} דקות.`); },
  ],
};
// The clock thirds prompt is clumsy for 20/40; keep the clean ones.
GENERATORS.clock[1] = (r) => { const [m, name] = pick(r, [[15, 'רבע שעה'], [30, 'חצי שעה'], [45, 'שלושה רבעי שעה'], [120, 'שעתיים']]); return N(`כמה דקות יש ב${name}?`, m, `בשעה 60 דקות, אז ב${name} ${m} דקות.`); };

const REVIEWABLE = new Set(['mcq', 'number', 'balance', 'fraction', 'numberline', 'order', 'robot', 'buckets', 'angle']);
const shuffle = (r, a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// A practice lesson: 6 new problems where the course has generators, topped up
// to 8 with exercises from the course's lessons, in random order.
export function practiceLesson(course, lessons, r = Math.random) {
  const gens = GENERATORS[course.id] || [];
  const fresh = gens.length ? Array.from({ length: 6 }, (_, i) => gens[(i + Math.floor(r() * gens.length)) % gens.length](r)) : [];
  const pool = shuffle(r, lessons.flatMap((l) => l.exercises || []).filter((e) => REVIEWABLE.has(e.type)));
  const review = pool.slice(0, Math.max(2, 8 - fresh.length)).map((e) => JSON.parse(JSON.stringify(e)));
  const exercises = shuffle(r, [...fresh, ...review]).map((e, i) => ({ ...e, id: `tp-${course.id}-${i}` }));
  return { id: `tp-${course.id}`, course: course.id, title_he: `תרגול: ${course.title_he}`, practice: true, exercises };
}
