// Browser text-to-speech for English. No keys, works offline on most devices.
import { rateFactor, getSettings } from './settings.js';

// Some Android devices still name Hebrew by its old code, iw.
const ALIASES = { he: ['he', 'iw'] };
let voice = null;
// Online voices (Chrome's "Google ..." voices) fail when HomeGuard has the
// internet off. After one such failure, only voices installed on the device.
let localOnly = false;
const usable = () => speechSynthesis.getVoices().filter((v) => !localOnly || v.localService);

// How human a voice sounds, from its name: Edge's "Natural" voices and Apple's
// premium ones are close to a person; old desktop and eSpeak voices are robotic.
export function voiceScore(v) {
  const n = v.name;
  let s = 0;
  if (/Natural|Neural|Premium|Enhanced|Siri/i.test(n)) s += 50;
  if (/Google/.test(n)) s += 20;
  if (/Samantha|Ava|Zoe|Allison|Carmit|Aria|Jenny|Hila|Avri/.test(n)) s += 10;
  if (/eSpeak|espeak|Microsoft (David|Zira|Mark|Asaf) Desktop/i.test(n)) s -= 30;
  if (/Desktop/.test(n)) s -= 10;
  return s;
}

// The voices for a language, most natural first.
export function voicesFor(lang) {
  if (!('speechSynthesis' in window)) return [];
  const base = lang.split('-')[0];
  const prefixes = ALIASES[base] || [base];
  const norm = (v) => v.lang.replace('_', '-').toLowerCase();
  return usable()
    .filter((v) => prefixes.some((p) => norm(v).startsWith(p)))
    .sort((a, b) => (voiceScore(b) + (norm(b) === lang.toLowerCase() ? 5 : 0)) - (voiceScore(a) + (norm(a) === lang.toLowerCase() ? 5 : 0)));
}

// The voice chosen in settings for the language, or else the most natural one.
function bestVoice(lang) {
  const chosen = getSettings()[`voice_${lang.split('-')[0]}`];
  const list = voicesFor(lang);
  return list.find((v) => v.name === chosen) || list[0] || null;
}

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  voice = bestVoice('en-US');
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
  return bestVoice(lang);
}

// After the voice is changed in settings.
export function refreshVoice() { pickVoice(); }

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
