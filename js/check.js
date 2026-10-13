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

// ---- speech ----
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

function speechWords(text) {
  return normalize(text)
    .replace(/\b(\d{1,2})\b/g, (m) => NUMBER_WORDS[Number(m)] || m) // recognizers write "7" for "seven"
    .split(' ').filter(Boolean);
}

// Longest common subsequence of words, so a skipped or extra word costs one
// word, not the rest of the sentence.
function lcsMarks(said, target) {
  const dp = Array.from({ length: said.length + 1 }, () => new Array(target.length + 1).fill(0));
  for (let i = 1; i <= said.length; i++) {
    for (let j = 1; j <= target.length; j++) {
      dp[i][j] = said[i - 1] === target[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const hit = new Array(target.length).fill(false);
  for (let i = said.length, j = target.length; i > 0 && j > 0;) {
    if (said[i - 1] === target[j - 1]) { hit[j - 1] = true; i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return hit;
}

export const SPEECH_PASS = 0.8;

// transcripts: the recognizer's alternatives, best first. Returns the best
// match: { pass, score, words: [{ word, ok }] } with words from the target.
export function checkSpeech(transcripts, target, alternatives = []) {
  let best = null;
  const shownWords = target.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
  for (const goal of [target, ...alternatives]) {
    const goalWords = speechWords(goal);
    for (const t of transcripts) {
      const hit = lcsMarks(speechWords(t), goalWords);
      const score = goalWords.length ? hit.filter(Boolean).length / goalWords.length : 0;
      if (!best || score > best.score) {
        // Map hits back onto the sentence as written when it's the main target.
        const words = goal === target && shownWords.length === goalWords.length
          ? shownWords.map((word, i) => ({ word, ok: hit[i] }))
          : goalWords.map((word, i) => ({ word, ok: hit[i] }));
        best = { score, words, heard: t };
      }
    }
  }
  return { ...best, pass: best.score >= SPEECH_PASS };
}
