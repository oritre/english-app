import { el, mixed, shuffle } from '../util.js';
import { speak, speakSequence, canSpeakLang } from '../speech.js';

// Hear something (a letter, a sound, a word) and tap the matching card: a
// letter or a picture. Built for learners who can't read English yet.
export function renderPick(root, ex, { setReady }) {
  let picked = null;
  const play = (slow = false) => speak(ex.audio, { slow });
  const intro = () => {
    const parts = [];
    if (ex.say_he && canSpeakLang('he-IL')) parts.push({ text: ex.say_he, lang: 'he-IL' });
    if (ex.audio) parts.push({ text: ex.audio, lang: 'en-US' });
    if (parts.length) speakSequence(parts);
  };
  const letters = ex.options.every((o) => !o.emoji);
  const cards = shuffle(ex.options).map((o) => {
    const card = el('button', { class: `choice-card pick-card ${letters ? 'letter' : ''}`, type: 'button', dir: 'ltr', 'data-value': o.value },
      o.emoji ? el('span', { class: 'emoji' }, o.emoji) : null,
      o.label ? el('span', { class: letters ? 'pick-letter' : 'en' }, o.label) : null);
    card.addEventListener('click', () => {
      cards.forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      picked = o.value;
      if (o.say) speak(o.say);
      setReady(true);
    });
    return card;
  });
  root.append(
    el('h2', { class: 'ex-title' }, ...mixed(ex.prompt_he)),
    el('div', { class: 'pick-prompt' },
      ex.show ? el('div', { class: 'pick-show', dir: 'ltr' }, ex.show) : null,
      ex.audio ? el('button', { class: 'speaker big', type: 'button', 'aria-label': 'השמע', onclick: () => play() }, '🔊') : null,
      ex.audio ? el('button', { class: 'speaker slow', type: 'button', 'aria-label': 'השמע לאט', onclick: () => play(true) }, '🐢') : null),
    el('div', { class: `choice-grid ${letters ? 'letters' : 'with-emoji'}` }, cards));
  setTimeout(intro, 250);
  return { getAnswer: () => picked };
}
