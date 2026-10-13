import { el, shuffle } from '../util.js';
import { speak } from '../speech.js';

const HEBREW = /[֐-׿]/;
const dirOf = (s) => (HEBREW.test(s) ? 'rtl' : 'ltr');

// Reading comprehension ("unseen"): the passage stays on screen, one question
// at a time, pick one answer. Questions and answers may be Hebrew or English.
export function renderRead(root, ex, { setReady }) {
  let picked = null;
  const options = shuffle(ex.options).map((opt) => {
    const btn = el('button', { class: 'read-option', type: 'button', dir: dirOf(opt) }, opt);
    btn.addEventListener('click', () => {
      options.forEach((o) => o.classList.remove('selected'));
      btn.classList.add('selected');
      picked = opt;
      setReady(true);
    });
    return btn;
  });
  root.append(
    el('h2', { class: 'ex-title' }, 'קראו את הקטע וענו'),
    el('div', { class: 'passage', dir: 'ltr', lang: 'en' },
      el('button', { class: 'speaker', type: 'button', 'aria-label': 'השמע את הקטע', onclick: () => speak(ex.passage) }, '🔊'),
      el('p', {}, ex.passage)),
    el('p', { class: 'read-question', dir: dirOf(ex.question) }, ex.question),
    el('div', { class: 'read-options' }, options));
  return { getAnswer: () => picked };
}
