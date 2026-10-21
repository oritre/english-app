import { el } from '../util.js';
import { speak, canSpeak } from '../speech.js';
import { voiceInput, voiceInputSupported } from '../voiceInput.js';

// Hear an English phrase and type it. Typos are forgiven (see check.js).
export function renderListenType(root, ex, { setReady, track, voiceTyping }) {
  const input = el('textarea', {
    class: 'type-input', dir: 'ltr', lang: 'en', rows: 2,
    autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'Type in English',
  });
  input.addEventListener('input', () => setReady(input.value.trim().length > 0));
  root.append(
    el('h2', { class: 'ex-title' }, 'הקשיבו וכתבו באנגלית'),
    el('div', { class: 'listen-row' },
      el('button', { class: 'speaker big', type: 'button', 'aria-label': 'השמע', onclick: () => speak(ex.audio_text) }, '🔊'),
      el('button', { class: 'speaker slow', type: 'button', 'aria-label': 'השמע לאט', onclick: () => speak(ex.audio_text, { slow: true }) }, '🐢')),
    input,
  );
  const voice = voiceTyping && voiceInputSupported();
  if (voice) root.append(voiceInput(input, { track }));
  // With voice typing the keyboard stays closed until the box is tapped.
  setTimeout(() => { speak(ex.audio_text); if (!voice) input.focus(); }, 250);
  return { getAnswer: () => input.value, allowTypos: true };
}

export function listenSupported() {
  return canSpeak();
}
