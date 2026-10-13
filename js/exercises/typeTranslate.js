import { el } from '../util.js';

// Free writing: translate a Hebrew sentence by typing it in English, no tiles.
export function renderTypeTranslate(root, ex, { setReady }) {
  const input = el('textarea', {
    class: 'type-input', dir: 'ltr', lang: 'en', rows: 3,
    autocapitalize: 'sentences', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'Write in English',
  });
  input.addEventListener('input', () => setReady(input.value.trim().length > 0));
  root.append(
    el('h2', { class: 'ex-title' }, 'כתבו באנגלית'),
    el('div', { class: 'prompt-bubble' }, ex.prompt),
    input);
  setTimeout(() => input.focus(), 50);
  return { getAnswer: () => input.value, allowTypos: true };
}
