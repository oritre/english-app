// Pure parts of the parasha film player (js/exercises/parasha.js), kept apart so the tests can load them.

// Reading time of one narration line when no voice reads it.
export const lineMs = (text) => Math.max(3200, String(text || '').length * 70);

// About how long the whole film runs, in minutes (for the title card).
export function filmMinutes(scenes) {
  const ms = (scenes || []).reduce((n, s) => n + 2200 + (s.say || []).reduce((m, t) => m + lineMs(t) + 350, 0), 0);
  return Math.max(1, Math.round(ms / 60000));
}

// The quiz opens once the narration of about 85% of the scenes has really played.
export const gateOpen = (playedCount, total) => total <= 0 || playedCount >= Math.ceil(total * 0.85);

// A scene may be opened when it is no further than the furthest one reached.
export const canJump = (target, furthest, total) => Number.isInteger(target) && target >= 0 && target < total && target <= furthest;

const bare = (s) => String(s || '').replace(/[֑-ׇ]/g, '').replace(/[^א-ת\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1);

// When the verse card and the Rashi card appear: the index of the narration line.
// The verse comes with the line that quotes it (shares words with it), otherwise
// after the first line. Rashi comes with the line that names him, otherwise in the
// second half of the scene. The two never start on the same line.
export function cues(scene) {
  const say = scene?.say || [];
  const n = say.length;
  let pasukLine = -1;
  let noteLine = -1;
  if (scene?.pasuk && n) {
    const words = new Set(bare(scene.pasuk.text));
    let best = 0;
    say.forEach((line, i) => {
      const hits = bare(line).filter((w) => words.has(w)).length;
      if (hits >= 2 && hits > best) { best = hits; pasukLine = i; }
    });
    if (pasukLine < 0) pasukLine = Math.min(1, n - 1);
  }
  if (scene?.note && n) {
    const who = String(scene.note.who || '').replace(/["״']/g, '');
    noteLine = say.findIndex((line) => who && line.replace(/["״']/g, '').includes(who));
    if (noteLine < 0) noteLine = Math.min(n - 1, Math.ceil(n / 2));
    if (noteLine === pasukLine) {
      if (noteLine + 1 < n) noteLine += 1; else if (pasukLine > 0) pasukLine -= 1;
    }
  }
  return { pasukLine, noteLine };
}

// A narration line cut into subtitle chunks of whole words, each no longer than
// max characters and preferably ending at a punctuation mark. Every word knows
// which share of the line's time it takes (from..to, 0..1): by its length, with
// a short breath after a comma and a longer one at the end of a sentence.
export function subtitlePlan(text, max = 64) {
  const tokens = String(text || '').split(/\s+/).filter(Boolean);
  const weight = (w) => w.length + 1 + (/[.!?:]["״']?$/.test(w) ? 5 : /[,;]$/.test(w) || w === '–' || w === '-' ? 2 : 0);
  const total = tokens.reduce((n, w) => n + weight(w), 0) || 1;
  const chunks = [];
  let cur = [];
  let len = 0;
  let t = 0;
  const close = () => { if (cur.length) chunks.push({ words: cur, from: cur[0].from, to: cur[cur.length - 1].to }); cur = []; len = 0; };
  tokens.forEach((w, i) => {
    if (len && len + 1 + w.length > max) close();
    const from = t / total;
    t += weight(w);
    cur.push({ w, from, to: t / total });
    len += (len ? 1 : 0) + w.length;
    const rest = tokens.slice(i + 1).join(' ').length;
    // A sentence end closes the chunk if what is left would not fit anyway, or the chunk is already long.
    if (/[.!?:]["״']?$/.test(w) && rest && (len + 1 + rest > max || len > max * 0.6)) close();
    else if (/[,;]$/.test(w) && len > max * 0.72 && rest > max * 0.25) close();
  });
  close();
  return chunks;
}

// Which chunk and which word are being said at this share of the line.
export function subtitleAt(chunks, frac) {
  const f = Math.min(0.9999, Math.max(0, frac || 0));
  let c = chunks.findIndex((ch) => f < ch.to);
  if (c < 0) c = chunks.length - 1;
  if (c < 0) return { chunk: -1, word: -1 };
  let w = chunks[c].words.findIndex((x) => f < x.to);
  if (w < 0) w = chunks[c].words.length - 1;
  return { chunk: c, word: w };
}

// The light of a scene, for the painted backdrop shown until the real picture
// arrives: from its effect and the words of its picture prompt.
export function mood(scene) {
  const fx = scene?.fx;
  const p = String(scene?.img || '').split('Scene:').pop().toLowerCase();
  // "Night: ...", "Night camp ...", "... in the night sky": the scene itself is at night (not a memory of one).
  const night = /^\s*night\b|night sky/.test(p);
  if (fx === 'night' || (night && /lamp|inside|candle/.test(p))) return 'lamp';
  if (fx === 'stars' || (fx !== 'sunset' && night)) return 'night';
  if (fx === 'sunset' || /sunset|dusk/.test(p)) return 'sunset';
  if (fx === 'mist' || /mist|fog/.test(p)) return 'mist';
  if (/dawn|sunrise/.test(p)) return 'dawn';
  if (fx === 'light' || /golden hour|late afternoon|morning sun|early morning/.test(p)) return 'gold';
  if (/pasture|field|flock|sheep|green|meadow/.test(p)) return 'pasture';
  return 'day';
}

// What stands on the ground of the painted backdrop, from the scene's emoji:
// people become robed paper-cut figures, a few things have their own drawing,
// any other creature or object is shown as the emoji's silhouette. Sky, light
// and abstract signs are left out (the painted sky already shows them).
const KINDS = {
  '🚶': 'man', '🧔': 'man', '🙏': 'man', '👨': 'man', '👴': 'man', '🧓': 'man', '👳': 'man',
  '👧': 'woman', '👰': 'woman', '👩': 'woman', '🧕': 'woman', '👵': 'woman',
  '👶': 'child', '👦': 'child', '🧒': 'child',
  '😴': 'sleeper',
  '⛺': 'tent', '🏕️': 'tent', '🪜': 'ladder', '🪨': 'stone', '🐑': 'sheep', '🐏': 'sheep', '🐐': 'goat',
  '🕳️': 'well', '🏠': 'house', '🏘️': 'house', '🏛️': 'house',
};
const SILHOUETTE = /^(?:[\u{1F400}-\u{1F43F}]|[\u{1F980}-\u{1F9AE}]|[\u{1F330}-\u{1F335}]|[\u{1F332}-\u{1F334}]|\u{1F54A}|\u{1F6B6}|\u{26F5}|\u{1F6D6})️?$/u;

export function artPlan(art) {
  const out = [];
  for (const raw of String(art || '').trim().split(/\s+/).filter(Boolean)) {
    const e = raw.split('~')[0];
    const kind = KINDS[e] || KINDS[e.replace(/️/g, '')] || (SILHOUETTE.test(e) ? 'emoji' : null);
    if (!kind) continue;
    // Twice the same thing is one bigger group, not two drawings.
    const same = out.find((o) => o.kind === kind && o.e === e);
    if (same) { same.count += 1; continue; }
    out.push({ kind, e, count: 1 });
  }
  return out.slice(0, 4);
}

// A small repeatable random source, so a scene's backdrop is the same every time.
export function seeded(key) {
  let h = 1779033703;
  for (const ch of String(key)) h = Math.imul(h ^ ch.codePointAt(0), 3432918353) >>> 0;
  return () => {
    h = (h + 0x6D2B79F5) >>> 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
