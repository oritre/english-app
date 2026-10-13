// Explains English answers that went wrong because of grammar, in Hebrew.
// Compares the learner's words with the expected sentence and returns the
// first rule that explains the difference, or null when it isn't grammar
// (a wrong word, a typo).
import { normalize } from './check.js';

const BE = ['am', 'is', 'are'];
const ARTICLES = ['a', 'an', 'the'];
const PREPS = ['in', 'on', 'at', 'to', 'from', 'with', 'for', 'of'];
const SUBJECT_BE = { i: 'am', you: 'are', we: 'are', they: 'are', he: 'is', she: 'is', it: 'is' };

const words = (s) => normalize(s).split(' ').filter(Boolean);
const count = (arr, set) => arr.filter((w) => set.includes(w)).length;
const sameBag = (a, b) => a.length === b.length && [...a].sort().join(' ') === [...b].sort().join(' ');

export function diagnose(input, expected) {
  const got = words(input);
  const want = words(expected);
  if (!got.length || got.join(' ') === want.join(' ')) return null;

  if (sameBag(got, want)) {
    return 'כל המילים נכונות, רק הסדר לא. באנגלית הסדר קבוע: מי עושה, הפעולה ואז השאר ("The dog is big"). תואר בא לפני שם העצם ("a big dog").';
  }

  // can + to
  const ci = got.indexOf('can');
  if (ci >= 0 && got[ci + 1] === 'to') return 'אחרי can לא כותבים to: "I can swim", לא "I can to swim".';

  // a / an
  for (let i = 0; i < got.length - 1; i++) {
    const vowel = /^[aeiou]/.test(got[i + 1]);
    if (got[i] === 'a' && vowel && want.includes('an')) return `לפני מילה שמתחילה בתנועה (a, e, i, o, u) כותבים an ולא a: "an ${got[i + 1]}".`;
    if (got[i] === 'an' && !vowel && want.includes('a')) return `an בא רק לפני תנועה. לפני "${got[i + 1]}" כותבים a.`;
  }
  if (count(got, ARTICLES) < count(want, ARTICLES)) {
    const missing = want.find((w) => ARTICLES.includes(w) && count(got, [w]) < count(want, [w]));
    return missing === 'the'
      ? 'חסרה המילה the. היא מקבילה ל־ה׳ הידיעה: "הכלב" = "the dog".'
      : `חסרה המילה ${missing}. באנגלית לפני שם עצם אחד (כלב, תפוח) מוסיפים a או an, גם כשבעברית אין מילה כזאת: "זה כלב" = "This is a dog".`;
  }

  // to be
  if (count(want, BE) > 0 && count(got, BE) < count(want, BE)) {
    return 'חסר פועל עזר (am, is, are). בעברית אומרים "הכלב גדול", אבל באנגלית חייבים פועל: "The dog is big".';
  }
  for (let i = 0; i < got.length; i++) {
    if (!BE.includes(got[i])) continue;
    const subj = got[i - 1];
    const right = SUBJECT_BE[subj] || (subj && want.includes('is') && !want.includes('are') ? 'is' : null);
    if (right && right !== got[i] && want.includes(right)) {
      return `עם ${subj} משתמשים ב־${right}: I am, you/we/they are, he/she/it is.`;
    }
  }
  if (count(got, BE) && count(want, BE) && got.find((w) => BE.includes(w)) !== want.find((w) => BE.includes(w))) {
    return 'פועל העזר לא מתאים: I am, you/we/they are, he/she/it is. גם עם שם עצם ברבים משתמשים ב־are ("My shoes are new").';
  }

  // have / has, do / does
  if (got.includes('have') && want.includes('has')) return 'עם he, she, it (הוא, היא, זה) כותבים has: "She has a cat".';
  if (got.includes('has') && want.includes('have')) return 'עם I, you, we, they כותבים have. רק עם he, she, it כותבים has.';
  if (got.includes('do') && want.includes('does')) return 'בשאלה או בשלילה על he, she, it משתמשים ב־does: "Does she like cats?"';
  if (got.includes('does') && want.includes('do')) return 'עם I, you, we, they משתמשים ב־do: "Do you like milk?"';

  // -s endings: third person verbs and plurals
  for (const w of want) {
    const stem = w.replace(/(es|s)$/, '');
    if (stem !== w && !got.includes(w) && (got.includes(stem) || got.includes(stem + 'e'))) {
      return `חסרה ה־s בסוף "${w}". אחרי he, she, it מוסיפים s לפועל ("she likes"), ובשם עצם ברבים מוסיפים s ("two dogs").`;
    }
  }
  for (const w of got) {
    const stem = w.replace(/(es|s)$/, '');
    if (stem !== w && !want.includes(w) && want.includes(stem)) {
      return `"${stem}" בלי s. אחרי I, you, we, they ואחרי can הפועל בא בלי s.`;
    }
  }

  // prepositions
  const gp = got.filter((w) => PREPS.includes(w));
  const wp = want.filter((w) => PREPS.includes(w));
  if (wp.length && gp.join(' ') !== wp.join(' ')) {
    return `מילת היחס צריכה להיות ${wp.join(', ')}. כמה כללים: at home / at school, in the park, on Monday, go to school.`;
  }
  return null;
}
