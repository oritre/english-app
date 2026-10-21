import { el, mixed } from '../util.js';
import { speak, speakSequence, canSpeakLang } from '../speech.js';

// Explanation card for absolute beginners: a big letter or picture, a short
// Hebrew explanation (read aloud when the device has a Hebrew voice) and
// examples to tap and hear. Nothing to answer; "הבנתי" moves on.
export function renderTeach(root, ex) {
  const narrate = () => {
    const he = canSpeakLang('he-IL');
    // A full explanation is a list of Hebrew and English parts, read in turn.
    const parts = ex.narration
      ? ex.narration.filter((p) => p.en || he).map((p) => (p.he ? { text: p.he, lang: 'he-IL' } : { text: p.en, lang: 'en-US' }))
      : [];
    if (!ex.narration && ex.say_he && he) parts.push({ text: ex.say_he, lang: 'he-IL' });
    if (!ex.narration && ex.say) parts.push({ text: ex.say, lang: 'en-US' });
    if (parts.length) speakSequence(parts);
  };
  const examples = (ex.examples || []).map((x) => el('button', { class: 'teach-example', type: 'button', onclick: () => speak(x.en, { slow: !!x.slow }) },
    x.emoji ? el('span', { class: 'emoji' }, x.emoji) : null,
    el('span', { class: 'teach-en', dir: 'ltr', lang: 'en' }, x.show || x.en),
    x.he ? el('span', { class: 'muted teach-he' }, x.he) : null));
  root.append(
    el('div', { class: 'teach-card' },
      ex.big ? el('button', { class: 'teach-big', type: 'button', dir: 'ltr', 'aria-label': 'השמע', onclick: narrate }, ex.big) : null,
      el('h2', { class: 'ex-title teach-title' }, ...mixed(ex.title_he),
        el('button', { class: 'speaker small', type: 'button', 'aria-label': 'הקראה', onclick: narrate }, '🔊')),
      ...(ex.body_he || []).map((p) => el('p', { class: 'teach-body' }, ...mixed(p))),
      examples.length ? el('div', { class: 'teach-examples' }, examples) : null,
      examples.length ? el('p', { class: 'muted small' }, 'לחצו על כל דוגמה כדי לשמוע') : null));
  setTimeout(narrate, 250);
  return { getAnswer: () => null, info: true };
}
