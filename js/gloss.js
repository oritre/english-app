// New words: English words the learner meets for the first time in a lesson's
// sentences get a dotted underline. Tapping one shows its Hebrew meaning and
// reads it aloud in English and then in Hebrew.
import { el } from './util.js';
import { speakSequence, canSpeakLang } from './speech.js';

const WORD = /([A-Za-z]+(?:'[a-z]+)?)/;
let pop = null;

function closePop() {
  if (pop) { pop.remove(); pop = null; }
}
document.addEventListener('click', (e) => { if (pop && !e.target.closest('.gloss, .gloss-pop')) closePop(); });

function show(btn, word, he) {
  closePop();
  pop = el('div', { class: 'gloss-pop', role: 'status' },
    el('bdi', { class: 'gloss-en', dir: 'ltr', lang: 'en' }, word), ' · ', el('span', { class: 'gloss-he' }, he));
  document.body.append(pop);
  const r = btn.getBoundingClientRect();
  const w = pop.offsetWidth;
  pop.style.top = `${window.scrollY + r.bottom + 8}px`;
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  const heSpoken = he.replace(/\(.*?\)/g, '').replace(/[A-Za-z=]+/g, '').trim();
  const parts = [{ text: word, lang: 'en-US' }];
  if (heSpoken && canSpeakLang('he-IL')) parts.push({ text: heSpoken, lang: 'he-IL' });
  speakSequence(parts);
}

// Returns text nodes and gloss buttons for one string of English.
export function glossify(text, newWords) {
  if (!newWords || !Object.keys(newWords).length) return [text];
  return String(text).split(WORD).map((part, i) => {
    const he = i % 2 ? newWords[part.toLowerCase()] : null;
    if (!he) return part;
    const btn = el('button', { class: 'gloss', type: 'button', title: he }, part);
    btn.addEventListener('click', (e) => { e.stopPropagation(); show(btn, part, he); });
    return btn;
  });
}

export { closePop };
