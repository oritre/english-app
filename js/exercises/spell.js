import { el, mixed, shuffle } from '../util.js';
import { speak } from '../speech.js';

// Build a short word from letter tiles (c-a-t) after hearing it.
export function renderSpell(root, ex, { setReady }) {
  const word = ex.answer;
  const placed = [];
  const slots = el('div', { class: 'spell-slots', dir: 'ltr' });
  const pool = el('div', { class: 'spell-pool', dir: 'ltr' });
  const tiles = shuffle([...word, ...(ex.extra || [])]).map((ch) => {
    const t = el('button', { class: 'tile spell-tile', type: 'button' }, ch);
    t.addEventListener('click', () => {
      if (t.disabled || placed.length >= word.length) return;
      t.disabled = true;
      placed.push(t);
      paint();
      if (placed.length === word.length) speak(placed.map((x) => x.textContent).join(''));
    });
    return t;
  });
  pool.append(...tiles);
  function paint() {
    slots.replaceChildren(...[...word].map((_, i) => {
      const t = placed[i];
      const s = el('button', { class: `spell-slot ${t ? 'filled' : ''}`, type: 'button' }, t ? t.textContent : '');
      if (t) s.addEventListener('click', () => { placed.splice(i, 1); t.disabled = false; paint(); });
      return s;
    }));
    setReady(placed.length === word.length);
  }
  paint();
  root.append(
    el('h2', { class: 'ex-title' }, ...mixed(ex.prompt_he)),
    el('div', { class: 'pick-prompt' },
      ex.emoji ? el('div', { class: 'pick-show' }, ex.emoji) : null,
      el('button', { class: 'speaker big', type: 'button', 'aria-label': 'השמע', onclick: () => speak(word) }, '🔊'),
      el('button', { class: 'speaker slow', type: 'button', 'aria-label': 'השמע לאט', onclick: () => speak(word, { slow: true }) }, '🐢')),
    slots, pool);
  setTimeout(() => speak(word), 250);
  return { getAnswer: () => placed.map((t) => t.textContent).join('') };
}
