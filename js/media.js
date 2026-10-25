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
