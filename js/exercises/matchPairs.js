import { el, en, shuffle } from '../util.js';
import { speak } from '../speech.js';

// Tap an English word and its Hebrew meaning. Self-checking: finishes when all
// pairs are matched; wrong taps are counted and reported as mistakes.
export function renderMatchPairs(root, ex, { setReady, finish }) {
  let selected = null;
  let wrongTaps = 0;
  let matched = 0;

  const make = (side, text, pairIndex) => {
    const b = el('button', { class: 'tile pair', type: 'button', dir: side === 'en' ? 'ltr' : 'rtl' }, text);
    b.dataset.pair = pairIndex;
    b.dataset.side = side;
    b.addEventListener('click', () => {
      if (b.classList.contains('matched')) return;
      if (side === 'en') speak(text);
      if (!selected || selected.dataset.side === side) {
        if (selected) selected.classList.remove('selected');
        selected = b;
        b.classList.add('selected');
        return;
      }
      if (selected.dataset.pair === b.dataset.pair) {
        selected.classList.replace('selected', 'matched');
        b.classList.add('matched');
        matched++;
        if (matched === ex.pairs.length) {
          setReady(true);
          finish(wrongTaps === 0);
        }
      } else {
        wrongTaps++;
        const other = selected;
        other.classList.remove('selected');
        [other, b].forEach((x) => x.classList.add('shake'));
        setTimeout(() => [other, b].forEach((x) => x.classList.remove('shake')), 400);
      }
      selected = null;
    });
    return b;
  };

  const left = shuffle(ex.pairs.map(([e], i) => make('en', e, i)));
  const right = shuffle(ex.pairs.map(([, h], i) => make('he', h, i)));
  root.append(
    el('h2', { class: 'ex-title' }, 'התאימו בין המילים'),
    el('div', { class: 'pairs' }, el('div', { class: 'col', dir: 'ltr' }, left), el('div', { class: 'col' }, right)),
  );
  return { getAnswer: () => null, selfChecking: true };
}
