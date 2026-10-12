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

export function speak(text, { slow = false } = {}) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  if (voice) u.voice = voice;
  u.rate = slow ? 0.6 : 0.95;
  speechSynthesis.speak(u);
}
