// Reading aloud. First choice is a natural voice recorded by the home Pi
// (pi/english_media makes each line once with Gemini and keeps it); when the Pi
// can't be reached or the line isn't ready in time, the device's own voice.
import { rateFactor, getSettings } from './settings.js';
import { MEDIA_BASE, mediaKey } from './media.js';

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

// The choice in settings that means "the Pi's natural voice" (the default).
export const PI_VOICE = 'pi';

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

// ---- The Pi's natural voice ----
const PI_LANGS = ['en', 'he'];
const START_MS = 3500;   // a line not playing by then is read by the device instead
let key = null;          // the family's media key, once known
let pausedUntil = 0;     // after repeated failures the Pi rests for a while
let fails = 0;
let token = 0;           // bumped by every new speak/stop, so old lines go quiet
const player = typeof Audio === 'function' ? new Audio() : null;
const urls = new Map();

mediaKey().then((k) => { key = k; }).catch(() => {});
// Phones allow sound from a page only after a touch; one silent play unlocks the player.
if (player && typeof document !== 'undefined') {
  const unlock = () => { player.muted = true; player.play().catch(() => {}).finally(() => { player.muted = false; }); };
  document.addEventListener('pointerdown', unlock, { once: true, capture: true });
}

const langOf = (lang) => (ALIASES.he.includes(lang.split('-')[0]) ? 'he' : lang.split('-')[0]);
let keyAsked = 0;
function piWanted(lang) {
  const l = langOf(lang);
  // The family code may be entered after the app loads.
  if (!key && Date.now() - keyAsked > 5000) { keyAsked = Date.now(); mediaKey().then((k) => { key = k; }).catch(() => {}); }
  if (!player || !key || !PI_LANGS.includes(l) || Date.now() < pausedUntil) return false;
  const chosen = getSettings()[`voice_${l}`];
  return !chosen || chosen === PI_VOICE;
}

async function piUrl(text, lang) {
  const l = langOf(lang);
  const t = String(text).trim();
  if (!t || t.length > 600 || !crypto.subtle) return null;
  const id = `${l}\n${t}`;
  if (!urls.has(id)) {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(id));
    const h = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
    urls.set(id, `${MEDIA_BASE}/tts/${h}.mp3?k=${key}&l=${l}&t=${encodeURIComponent(t)}`);
  }
  return urls.get(id);
}

function failed() {
  fails += 1;
  if (fails >= 3) { pausedUntil = Date.now() + 10 * 60 * 1000; fails = 0; }
}

// Plays one line from the Pi: 'done' when it played, 'fail' when the device should read it.
async function playPi(text, lang, rate, mine) {
  const url = piWanted(lang) && await piUrl(text, lang);
  if (!url || mine !== token) return url ? 'stale' : 'fail';
  return new Promise((resolve) => {
    let started = false;
    let over = false;
    const end = (r) => {
      if (over) return;
      over = true;
      clearTimeout(timer);
      player.onplaying = player.onended = player.onerror = null;
      resolve(r);
    };
    // Counted once per line, however many of the player's events report it.
    const fail = () => { if (over) return; failed(); end('fail'); };
    const timer = setTimeout(() => { if (!started) { player.pause(); fail(); } }, START_MS);
    player.onplaying = () => { started = true; fails = 0; };
    player.onended = () => end('done');
    player.onerror = () => (started ? end('done') : fail());
    player.src = url;
    // Gemini reads at a natural pace; the speed buttons stretch it like the device voice.
    const r = Math.min(2, Math.max(0.5, rate / 0.95));
    player.defaultPlaybackRate = r;
    player.playbackRate = r;
    player.preservesPitch = true;
    player.play().catch(() => { if (!started) fail(); });
    stopPlayer = () => { player.pause(); end('stale'); };
  });
}
let stopPlayer = () => {};

// Reads one line by the device's voice; resolves when it ends.
function sayDevice(text, lang, rate) {
  return new Promise((resolve) => {
    if (!canSpeak()) { resolve(); return; }
    const safety = setTimeout(resolve, String(text).length * 200 + 4000);
    const done = () => { clearTimeout(safety); resolve(); };
    speechSynthesis.speak(utterance(text, lang, rate, { onend: done, onerror: done }));
  });
}

async function sayAll(parts, rate) {
  const mine = ++token;
  stopPlayer();
  try { speechSynthesis.cancel(); } catch { /* no TTS */ }
  for (const { text, lang = 'en-US' } of parts) {
    if (mine !== token) return;
    const r = await playPi(text, lang, rate, mine);
    if (mine !== token || r === 'stale') return;
    if (r === 'fail') await sayDevice(text, lang, rate);
  }
}

// Silences whatever is being read (before the microphone opens, or on leaving).
export function stopSpeech() {
  token += 1;
  stopPlayer();
  try { speechSynthesis.cancel(); } catch { /* no TTS */ }
}

// Asks the Pi to prepare a lesson's lines ahead, two at a time, so they play at once.
export async function warmSpeech(parts) {
  if (!player || !key) return;
  const queue = parts.filter((p) => p?.text && piWanted(p.lang || 'en-US')).slice(0, 40);
  const worker = async () => {
    while (queue.length && Date.now() >= pausedUntil) {
      const { text, lang = 'en-US' } = queue.shift();
      const url = await piUrl(text, lang);
      if (!url) continue;
      try {
        const res = await fetch(`${url}&warm=1`);
        if (res.status === 404) { pausedUntil = Date.now() + 10 * 60 * 1000; return; } // no key on the Pi yet
      } catch { failed(); return; }
    }
  };
  await Promise.all([worker(), worker()]);
}

// True when the language can be read aloud: by the Pi, or by a voice on the
// device. Voices can load late, so before they arrive we assume English works.
export function canSpeakLang(lang) {
  if (piWanted(lang)) return true;
  if (!canSpeak()) return false;
  if (speechSynthesis.getVoices().length === 0) return lang.startsWith('en');
  return !!voiceFor(lang);
}

// Speaks several lines one after another (e.g. a word in English, then in Hebrew).
export function speakSequence(parts) {
  if (!canSpeak() && !player) return;
  sayAll(parts, 0.9 * rateFactor());
}

export function speak(text, { slow = false, lang = 'en-US' } = {}) {
  if (!canSpeak() && !player) return;
  sayAll([{ text, lang }], (slow ? 0.6 : 0.95) * rateFactor());
}
