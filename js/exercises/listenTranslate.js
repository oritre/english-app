import { el } from '../util.js';
import { speak, canSpeakLang } from '../speech.js';
import { shuffle } from '../util.js';

// Hear a sentence (Hebrew or English) without seeing it, and build the
// translation from tiles. The text can be revealed if the voice is missing
// or the learner is stuck.
export function renderListenTranslate(root, ex, { setReady }) {
  const fromHebrew = ex.lang === 'he';
  const answerDir = fromHebrew ? 'ltr' : 'rtl';
  const voice = fromHebrew ? 'he-IL' : 'en-US';
  const hasVoice = canSpeakLang(voice);
  const play = (slow) => speak(ex.audio_text, { slow, lang: voice });

  const text = el('div', { class: 'reveal-text', dir: fromHebrew ? 'rtl' : 'ltr', hidden: hasVoice }, ex.audio_text);
  const reveal = el('button', { class: 'link-btn', type: 'button', hidden: !hasVoice, onclick: () => { text.hidden = false; reveal.hidden = true; } }, 'הצגת הטקסט');

  const chosen = [];
  const line = el('div', { class: 'answer-line', dir: answerDir });
  const bank = el('div', { class: 'word-bank', dir: answerDir });
  bank.append(...shuffle(ex.bank).map((word) => {
    const tile = el('button', { class: 'tile', type: 'button', dir: answerDir }, word);
    tile.addEventListener('click', () => {
      if (tile.parentElement === bank) { line.append(tile); chosen.push(tile); }
      else { bank.append(tile); chosen.splice(chosen.indexOf(tile), 1); }
      setReady(chosen.length > 0);
    });
    return tile;
  }));

  root.append(
    el('h2', { class: 'ex-title' }, fromHebrew ? 'הקשיבו ותרגמו לאנגלית' : 'הקשיבו ותרגמו לעברית'),
    el('div', { class: 'listen-row' },
      el('button', { class: 'speaker big', type: 'button', 'aria-label': 'השמע', onclick: () => play(false) }, '🔊'),
      el('button', { class: 'speaker slow', type: 'button', 'aria-label': 'השמע לאט', onclick: () => play(true) }, '🐢')),
    hasVoice ? null : el('p', { class: 'hint' }, fromHebrew ? 'אין במכשיר הזה קול עברי, אז הטקסט מוצג.' : 'אין במכשיר הזה קול אנגלי, אז הטקסט מוצג.'),
    text, reveal, line, bank);
  if (hasVoice) setTimeout(() => play(false), 250);
  return { getAnswer: () => chosen.map((t) => t.textContent).join(' ') };
}
