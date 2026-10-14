// Browser text-to-speech for English. No keys, works offline on most devices.
let voice = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  voice = voices.find((v) => v.lang === 'en-US' && /Google|Samantha|Microsoft/.test(v.name))
    || voices.find((v) => v.lang === 'en-US')
    || voices.find((v) => v.lang.startsWith('en'))
    || null;
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener('voiceschanged', pickVoice);
}

export function canSpeak() {
  return 'speechSynthesis' in window;
}

function voiceFor(lang) {
  if (lang === 'en-US') return voice;
  const prefix = lang.split('-')[0];
  return speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(prefix)) || null;
}

// True when the device has a voice for the language. Voices can load late, so
// before they arrive we assume English works (almost every device has it).
export function canSpeakLang(lang) {
  if (!canSpeak()) return false;
  if (speechSynthesis.getVoices().length === 0) return lang.startsWith('en');
  return !!voiceFor(lang);
}

// Speaks several utterances one after another (e.g. a word in English, then in Hebrew).
export function speakSequence(parts) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  for (const { text, lang = 'en-US' } of parts) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const v = voiceFor(lang);
    if (v) u.voice = v;
    u.rate = 0.9;
    speechSynthesis.speak(u);
  }
}

export function speak(text, { slow = false, lang = 'en-US' } = {}) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const v = voiceFor(lang);
  if (v) u.voice = v;
  u.rate = slow ? 0.6 : 0.95;
  speechSynthesis.speak(u);
}
