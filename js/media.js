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
