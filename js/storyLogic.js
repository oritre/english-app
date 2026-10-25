// Pure parts of the general-knowledge player (js/exercises/story.js), kept apart so the tests can load them.

const MOTIONS = new Set(['pop', 'float', 'sail', 'walk', 'spin', 'pulse', 'rise', 'fall', 'shake', 'grow', 'swing']);
// Where the pieces stand, by how many there are: [x%, y%, size in em].
const LAYOUTS = {
  1: [[50, 52, 7]],
  2: [[38, 54, 6.5], [70, 46, 4.5]],
  3: [[50, 54, 6.5], [20, 34, 4], [80, 34, 4]],
  4: [[50, 56, 6.5], [18, 30, 3.8], [82, 30, 3.8], [80, 76, 3.4]],
  5: [[50, 56, 6.5], [18, 30, 3.6], [82, 30, 3.6], [80, 78, 3.2], [20, 78, 3.2]],
  6: [[50, 56, 6], [18, 28, 3.4], [82, 28, 3.4], [82, 78, 3], [18, 78, 3], [50, 22, 3]],
};

export function parseArt(art) {
  const tokens = String(art || '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const spots = LAYOUTS[tokens.length] || [];
  return tokens.map((t, i) => {
    const [e, motion] = t.split('~');
    const [x, y, size] = spots[i];
    return { e, x, y, size, motion: MOTIONS.has(motion) ? motion : i === 0 ? 'pop' : 'float' };
  });
}

// Reading time without a voice: long enough to read the subtitle.
export const sceneMs = (text) => Math.max(3200, String(text).length * 70);

// General-knowledge quizzes come in grade bands: a question may carry
// grades: [first, last]. A learner gets the questions for their grade, or the
// nearest band when none covers it; anything without grades is for everyone.
// No grade set counts as an adult.
export function forGrade(exercises, grade) {
  const banded = exercises.filter((e) => e.grades);
  if (!banded.length) return exercises;
  const g = parseInt(grade, 10) || 13;
  const gap = (e) => (g < e.grades[0] ? e.grades[0] - g : g > e.grades[1] ? g - e.grades[1] : 0);
  const best = Math.min(...banded.map(gap));
  return exercises.filter((e) => !e.grades || gap(e) === best);
}
