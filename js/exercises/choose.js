import { el, en, shuffle } from '../util.js';
import { speak } from '../speech.js';

// "Which one is 'apple'?" Pick one card. Prompt is Hebrew, options are English.
export function renderChoose(root, ex, { setReady }) {
  let picked = null;
  const cards = shuffle(ex.options).map((opt) => {
    const card = el('button', { class: 'choice-card', type: 'button', 'data-value': opt.en },
      opt.emoji ? el('span', { class: 'emoji' }, opt.emoji) : null,
      en(opt.en));
    card.addEventListener('click', () => {
      cards.forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      picked = opt.en;
      speak(opt.en);
      setReady(true);
    });
    return card;
  });
  root.append(
    el('h2', { class: 'ex-title' }, ex.prompt_he),
    el('div', { class: `choice-grid ${ex.options.some((o) => o.emoji) ? 'with-emoji' : ''}` }, cards),
  );
  return { getAnswer: () => picked };
}
