// Answer checking. Pure functions, no DOM, so they run under node tests too.

const CONTRACTIONS = [
  [/\bi'm\b/g, 'i am'],
  [/\byou're\b/g, 'you are'],
  [/\bhe's\b/g, 'he is'],
  [/\bshe's\b/g, 'she is'],
  [/\bit's\b/g, 'it is'],
  [/\bwe're\b/g, 'we are'],
  [/\bthey're\b/g, 'they are'],
  [/\bthat's\b/g, 'that is'],
  [/\bwhat's\b/g, 'what is'],
  [/\bi've\b/g, 'i have'],
  [/\bdon't\b/g, 'do not'],
  [/\bdoesn't\b/g, 'does not'],
  [/\bisn't\b/g, 'is not'],
  [/\baren't\b/g, 'are not'],
  [/\bcan't\b/g, 'cannot'],
  [/\bcan not\b/g, 'cannot'],
];

const FINAL_LETTERS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

export function normalize(text) {
  let s = String(text || '').toLowerCase();
  s = s.replace(/[‘’׳]/g, "'");
  s = s.replace(/[֑-ׇ]/g, ''); // niqqud and cantillation
  s = s.replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c]);
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
  s = s.replace(/[.,!?;:"()\-־]/g, ' ');
  s = s.replace(/'/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// Returns { result: 'correct' | 'typo' | 'wrong', expected }.
// allowTypos is for typed answers only; tile answers are exact after normalizing.
export function checkAnswer(input, answer, alternatives = [], { allowTypos = false } = {}) {
  const given = normalize(input);
  const accepted = [answer, ...alternatives].map(normalize);
  if (accepted.includes(given)) return { result: 'correct', expected: answer };
  if (allowTypos && given.length > 0) {
    for (const target of accepted) {
      const budget = Math.max(1, Math.floor(target.length / 8));
      if (levenshtein(given, target) <= budget) return { result: 'typo', expected: answer };
    }
  }
  return { result: 'wrong', expected: answer };
}
