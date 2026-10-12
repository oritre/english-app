import { el, en, shuffle } from '../util.js';
import { speak } from '../speech.js';

// Translate a sentence by tapping word tiles. Works both ways:
// translate_he_en (Hebrew prompt, English tiles) and translate_en_he.
export function renderWordBank(root, ex, { setReady }) {
  const toEnglish = ex.type === 'translate_he_en';
  const answerDir = toEnglish ? 'ltr' : 'rtl';
  const chosen = [];

  const prompt = toEnglish
    ? el('div', { class: 'prompt-bubble' }, ex.prompt)
    : el('div', { class: 'prompt-bubble' },
        el('button', { class: 'speaker', type: 'button', 'aria-label': 'השמע', onclick: () => speak(ex.prompt) }, '🔊'),
        en(ex.prompt));
  if (!toEnglish) setTimeout(() => speak(ex.prompt), 250);

  const line = el('div', { class: 'answer-line', dir: answerDir });
  const bank = el('div', { class: 'word-bank', dir: answerDir });

  const tiles = shuffle(ex.bank).map((word) => {
    const tile = el('button', { class: 'tile', type: 'button', dir: answerDir }, word);
    tile.addEventListener('click', () => {
      if (tile.parentElement === bank) {
        line.append(tile);
        chosen.push(tile);
        if (toEnglish) speak(word);
      } else {
        bank.append(tile);
        chosen.splice(chosen.indexOf(tile), 1);
      }
      setReady(chosen.length > 0);
    });
    return tile;
  });
  bank.append(...tiles);

  root.append(
    el('h2', { class: 'ex-title' }, toEnglish ? 'תרגמו לאנגלית' : 'תרגמו לעברית'),
    prompt, line, bank,
  );
  return { getAnswer: () => chosen.map((t) => t.textContent).join(' ') };
}
