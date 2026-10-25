// The lines a lesson will read aloud, in order, so the home Pi can record them
// before they are needed (see warmSpeech in speech.js). Lines read straight
// away come first; the explanations and examples after.
const HEB = /[֐-׿]/;

export function spokenLines(exercises, { thinkAloud = false } = {}) {
  const first = [];
  const later = [];
  const add = (list, text, lang) => {
    const t = typeof text === 'string' ? text.trim() : '';
    if (!t) return;
    if (lang === 'en-US' && HEB.test(t)) return;
    list.push({ text: t, lang });
  };
  for (const ex of exercises || []) {
    for (const p of ex.narration || []) add(first, p.he || p.en, p.he ? 'he-IL' : 'en-US');
    if (!ex.narration) { add(first, ex.say_he, 'he-IL'); add(first, typeof ex.say === 'string' ? ex.say : '', 'en-US'); }
    add(first, ex.audio, 'en-US');
    add(first, ex.audio_text, 'en-US');
    add(first, ex.word, 'en-US');
    if (thinkAloud && ex.prompt_he) add(first, [ex.prompt_he, ex.say_he].filter(Boolean).join('. '), 'he-IL');
    if (ex.type === 'speak') add(later, ex.text, 'en-US');
    for (const x of ex.examples || []) add(later, x.en, 'en-US');
    for (const o of ex.options || []) if (o && typeof o === 'object') { add(later, o.say, 'en-US'); add(later, o.en, 'en-US'); }
    add(later, ex.explain_he, 'he-IL');
  }
  const seen = new Set();
  return [...first, ...later].filter((p) => {
    const id = `${p.lang}\n${p.text}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
