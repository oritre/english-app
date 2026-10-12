import { el, en, shuffle } from '../util.js';
import { speak } from '../speech.js';

export function renderFillBlank(root, ex, { setReady }) {
  let picked = null;
  const [before, after] = ex.sentence.split('___');
  const gap = el('span', { class: 'gap' }, '    ');
  const sentence = el('div', { class: 'prompt-bubble', dir: 'ltr', lang: 'en' }, before, gap, after);
  const options = shuffle(ex.options).map((opt) => {
    const b = el('button', { class: 'tile', type: 'button', dir: 'ltr' }, opt);
    b.addEventListener('click', () => {
      options.forEach((o) => o.classList.remove('selected'));
      b.classList.add('selected');
      picked = opt;
      gap.textContent = opt;
      setReady(true);
    });
    return b;
  });
  root.append(
    el('h2', { class: 'ex-title' }, 'השלימו את המשפט'),
    ex.hint_he ? el('p', { class: 'hint' }, ex.hint_he) : null,
    sentence,
    el('div', { class: 'word-bank', dir: 'ltr' }, options),
  );
  return { getAnswer: () => picked, fullSentence: () => ex.sentence.replace('___', ex.answer), speakAfter: true };
}
