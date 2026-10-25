// Browser text-to-speech for English. No keys, works offline on most devices.
import { rateFactor } from './settings.js';

let voice = null;
// Online voices (Chrome's "Google ..." voices) fail when HomeGuard has the
// internet off. After one such failure, only voices installed on the device.
let localOnly = false;
const usable = () => speechSynthesis.getVoices().filter((v) => !localOnly || v.localService);

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = usable();
  voice = voices.find((v) => v.lang === 'en-US' && /Google|Samantha|Microsoft/.test(v.name))
    || voices.find((v) => v.lang === 'en-US')
    || voices.find((v) => v.lang.startsWith('en'))
    || null;
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener('voiceschanged', pickVoice);
}

export function voiceName(lang) {
  if (!canSpeak()) return null;
  return voiceFor(lang)?.name || null;
}

export function canSpeak() {
  return 'speechSynthesis' in window;
}

function voiceFor(lang) {
  if (lang === 'en-US') return voice;
  const prefix = lang.split('-')[0];
  return usable().find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(prefix)) || null;
}

// handlers: optional onend, onerror and onboundary, for callers that follow
// one line themselves (the cartoon's narration). A retry keeps them.
export function utterance(text, lang, rate, handlers = {}) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const v = voiceFor(lang);
  if (v) u.voice = v;
  u.rate = rate;
  if (handlers.onend) u.onend = handlers.onend;
  if (handlers.onboundary) u.onboundary = handlers.onboundary;
  u.onerror = (e) => {
    if (v && !v.localService && ['network', 'synthesis-failed', 'synthesis-unavailable'].includes(e.error)) {
      if (!localOnly) { localOnly = true; pickVoice(); }
      speechSynthesis.speak(utterance(text, lang, rate, handlers));
      return;
    }
    handlers.onerror?.(e);
  };
  return u;
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
  for (const { text, lang = 'en-US' } of parts) speechSynthesis.speak(utterance(text, lang, 0.9 * rateFactor()));
}

export function speak(text, { slow = false, lang = 'en-US' } = {}) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance(text, lang, (slow ? 0.6 : 0.95) * rateFactor()));
}
