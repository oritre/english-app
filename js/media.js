// General-knowledge videos come from the family's own server, not YouTube: an
// add-on on the home Pi (pi/english_media) downloads each video once and serves
// it over a public https address (Tailscale Funnel), so it plays anywhere,
// without ads, and with HomeGuard's internet off (the address is on its
// always-open list). It serves only devices that know the family code.
import { getFamilyCode } from './sync.js';

export const MEDIA_BASE = 'https://english-media.tailafe754.ts.net';

// The key the server checks: the first 16 hex digits of SHA-256("media:" + code).
// null when this device has no family code.
export async function mediaKey() {
  const code = getFamilyCode();
  if (!code || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`media:${code}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

export async function videoUrl(youtubeId) {
  const key = await mediaKey();
  return key ? `${MEDIA_BASE}/v/${encodeURIComponent(youtubeId)}.mp4?k=${key}` : null;
}

// A storybook illustration painted once by the Pi (Gemini image model) and kept
// there: /img/<hash>.jpg, hash = first 16 hex of SHA-1("img\n" + prompt), the
// same in pi/english_media/server.py img_hash. null without a family code.
export async function imageUrl(prompt) {
  const key = await mediaKey();
  const p = String(prompt || '').trim();
  if (!key || !p || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`img\n${p}`));
  const h = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  return `${MEDIA_BASE}/img/${h}.jpg?k=${key}&p=${encodeURIComponent(p)}`;
}

async function sha1hex(text) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// One frame of a film character, painted by the Pi on flat green and cut out
// into a transparent webp: /sprite/<hash>.webp, hash = first 16 hex of
// SHA-1("sprite\n" + ref + "\n" + prompt) (server.py sprite_hash). With ref (the
// base frame's hash) the Pi edits the base picture, so the talking and blinking
// frames line up with it exactly; the base must be painted first.
// Resolves to { url, hash }, or null without a family code.
export async function spriteUrl(prompt, ref = '') {
  const key = await mediaKey();
  const p = String(prompt || '').trim();
  if (!key || !p || !crypto.subtle) return null;
  const hash = await sha1hex(`sprite\n${ref}\n${p}`);
  const r = ref ? `&r=${ref}` : '';
  return { hash, // c = the cut-out version (bumped when the Pi cuts its sprites differently), so no device keeps an old one.
  url: `${MEDIA_BASE}/sprite/${hash}.webp?c=4&k=${key}&p=${encodeURIComponent(p)}${r}` };
}

// A film line in a character's own voice (Gemini voice name + acting note),
// made once by the Pi: hash = SHA-1("he|<voice>|<style>\n<text>") (server.py tts_hash).
export async function characterLineUrl(text, voice, style = '', lang = 'he') {
  const key = await mediaKey();
  const t = String(text || '').trim();
  if (!key || !t || t.length > 600 || !crypto.subtle) return null;
  const head = voice || style ? `${lang}|${voice || ''}|${style || ''}` : lang;
  const h = await sha1hex(`${head}\n${t}`);
  return `${MEDIA_BASE}/tts/${h}.mp3?k=${key}&l=${lang}&t=${encodeURIComponent(t)}`
    + `&v=${encodeURIComponent(voice || '')}&s=${encodeURIComponent(style || '')}`;
}

// A piece of background music for a film, made once by the Pi (Lyria) and kept
// there: /music/<hash>.mp3, hash = first 16 hex of SHA-1("music\n" + prompt)
// (server.py music_hash). null without a family code.
export async function musicUrl(prompt) {
  const key = await mediaKey();
  const p = String(prompt || '').trim();
  if (!key || !p || !crypto.subtle) return null;
  const h = await sha1hex(`music\n${p}`);
  return `${MEDIA_BASE}/music/${h}.mp3?k=${key}&p=${encodeURIComponent(p)}`;
}
