import { el, en, shuffle } from '../util.js';
import { speak } from '../speech.js';

// Tap an English word and its Hebrew meaning. Self-checking: finishes when all
// pairs are matched; wrong taps are counted and reported as mistakes.
export function renderMatchPairs(root, ex, { setReady, finish, track }) {
  let selected = null;
  let wrongTaps = 0;
  let matched = 0;

  // Letter matching (A with a) puts English on both sides.
  const bothEn = ex.right === 'en';
  const make = (side, text, pairIndex) => {
    const b = el('button', { class: `tile pair ${bothEn ? 'letter' : ''}`, type: 'button', dir: side === 'en' || bothEn ? 'ltr' : 'rtl' }, text);
    b.dataset.pair = pairIndex;
    b.dataset.side = side;
    b.addEventListener('click', () => {
      if (b.classList.contains('matched')) return;
      if (side === 'en' || bothEn) speak(ex.say?.[text] || text);
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
        const [a, c] = other.dataset.side === 'en' ? [other, b] : [b, other];
        track?.('mismatch', `${a.textContent}|${c.textContent}`);
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
    el('h2', { class: 'ex-title' }, ex.title_he || 'התאימו בין המילים'),
    el('div', { class: 'pairs' }, el('div', { class: 'col', dir: 'ltr' }, left), el('div', { class: 'col', dir: bothEn ? 'ltr' : null }, right)),
  );
  return { getAnswer: () => null, selfChecking: true };
}
