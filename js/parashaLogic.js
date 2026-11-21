// Pure parts of the parasha film player (js/exercises/parasha.js), kept apart so the tests can load them.

// A line of a scene is either a string (the narrator) or {who, text, tone, act}
// (a character speaks). Always the same shape: who is '' for the narrator.
export function sayLine(line) {
  if (line && typeof line === 'object') {
    return { who: String(line.who || ''), text: String(line.text || '').trim(), tone: String(line.tone || ''), act: String(line.act || '') };
  }
  return { who: '', text: String(line || '').trim(), tone: '', act: '' };
}
export const lineText = (line) => (line && typeof line === 'object' ? String(line.text || '') : String(line || ''));

// What a character does with a line: 'gesture', 'walk:<x>' (0..1 across the stage), 'turn'. Anything else is ignored.
export function parseAct(act) {
  const out = { gesture: false, turn: false, walk: null };
  for (const part of String(act || '').split(/[\s,;]+/).filter(Boolean)) {
    const m = /^walk:(-?\d*\.?\d+)$/.exec(part);
    if (part === 'gesture') out.gesture = true;
    else if (part === 'turn') out.turn = true;
    else if (m && Number.isFinite(Number(m[1]))) out.walk = Math.min(1.3, Math.max(-0.3, Number(m[1]))); // past 0 or 1: off the stage
  }
  return out;
}

// Reading time of one line when no voice reads it.
export const lineMs = (line) => Math.max(3200, lineText(line).length * 70);

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
      const hits = bare(lineText(line)).filter((w) => words.has(w)).length;
      if (hits >= 2 && hits > best) { best = hits; pasukLine = i; }
    });
    if (pasukLine < 0) pasukLine = Math.min(1, n - 1);
  }
  if (scene?.note && n) {
    const who = String(scene.note.who || '').replace(/["״']/g, '');
    noteLine = say.findIndex((line) => who && lineText(line).replace(/["״']/g, '').includes(who));
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

// ---- the puppets (js/exercises/parashaPuppets.js) ----

// The frames of the cast in the order they must be painted: every base first,
// then what is edited from the base (talk, blink, gesture), then gesture_talk
// (edited from gesture). only: the characters to include (default: all).
const FRAME_PASSES = [['base'], ['talk', 'blink', 'gesture'], ['gesture_talk']];
export function framePlan(cast, only = null) {
  const out = [];
  const whos = Object.keys(cast || {}).filter((w) => !only || only.includes(w));
  for (const pass of FRAME_PASSES) {
    for (const who of whos) {
      const frames = cast[who]?.frames || {};
      for (const name of pass) {
        const f = frames[name];
        if (!f?.p) continue;
        const ref = name === 'base' ? '' : String(f.ref || 'base');
        if (ref && !frames[ref]?.p) continue;
        out.push({ who, name, p: f.p, ref });
      }
    }
  }
  return out;
}

// How loud a recording is over time: one value 0..1 per window (25 ms), relative
// to the loud parts of this recording, so a quiet voice opens the mouth as well.
export function envelope(samples, sampleRate, win = 0.025) {
  const step = Math.max(1, Math.round(sampleRate * win));
  const n = Math.ceil(samples.length / step);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const end = Math.min(samples.length, (i + 1) * step);
    for (let k = i * step; k < end; k++) sum += samples[k] * samples[k];
    env[i] = Math.sqrt(sum / Math.max(1, end - i * step));
  }
  const sorted = Float32Array.from(env).sort();
  const top = sorted[Math.min(n - 1, Math.floor(n * 0.92))] || 0;
  if (top < 1e-4) return { env: env.fill(0), win };
  for (let i = 0; i < n; i++) env[i] = Math.min(1, env[i] / top);
  return { env, win };
}
export function levelAt(track, sec) {
  if (!track || !track.env.length || !(sec >= 0)) return 0;
  const i = Math.floor(sec / track.win);
  return i < track.env.length ? track.env[i] : 0;
}

// The mouth from the loudness, without flicker: it opens above `on`, closes
// below `off`, holds each state at least `hold` ms, and a long loud stretch is
// broken by a short closing (a new syllable) so the mouth never just hangs open.
// state: {open, since} (ms); returns the new state (the same object when unchanged).
export const MOUTH = { on: 0.3, off: 0.16, hold: 85, maxOpen: 300, shut: 75 };
export function mouthStep(state, level, tMs, o = MOUTH) {
  const st = state || { open: false, since: -1e9 };
  const held = tMs - st.since;
  if (st.open) {
    if (held < o.hold) return st;
    if (level < o.off) return { open: false, since: tMs };
    if (held >= o.maxOpen) return { open: false, since: tMs, forced: true };
    return st;
  }
  if (held < (st.forced ? o.shut : o.hold)) return st;
  if (level > o.on) return { open: true, since: tMs };
  return st.forced ? { open: false, since: st.since } : st;
}

// With no recording to measure (the device's voice, or no voice): a loudness that
// rises and falls at the pace of syllables, a little irregular, with short rests.
export function flapLevel(tMs) {
  const t = tMs / 1000;
  const syl = Math.sin(t * 2 * Math.PI * 4.6) * 0.5 + 0.5;
  const drift = Math.sin(t * 2 * Math.PI * 1.3 + 1.7) * 0.5 + 0.5;
  const rest = Math.sin(t * 2 * Math.PI * 0.37 + 0.4) > 0.86 ? 0 : 1;
  return rest * (0.12 + 0.88 * syl * (0.55 + 0.45 * drift));
}

// How the figures are tinted to sit in the scene's light.
export function puppetGrade(scene) {
  const fx = scene?.fx;
  if (fx === 'sunset') return 'warm';
  if (fx === 'stars') return 'night';
  if (fx === 'night') return 'lamp';
  if (fx === 'light') return 'glow';
  const m = mood(scene);
  return { night: 'night', lamp: 'lamp', sunset: 'warm', dawn: 'warm', mist: 'mist', gold: 'glow' }[m] || 'day';
}

// The figures of a scene, cleaned: only characters of the cast, x inside the stage.
export function stagePlan(scene, cast) {
  return (Array.isArray(scene?.stage) ? scene.stage : []).filter((it) => it && cast?.[it.who]?.frames?.base?.p).map((it) => ({
    who: it.who,
    x: Math.min(1, Math.max(0, Number.isFinite(Number(it.x)) ? Number(it.x) : 0.5)),
    face: it.face === 'l' ? -1 : 1,
    enter: it.enter === 'l' || it.enter === 'r' ? it.enter : '',
    scale: Math.min(1.6, Math.max(0.4, Number(it.scale) || 1)),
  }));
}

// ---- the cut (ori 2026-11-21: present the films like the Hidabroot Kids videos) ----

// Their picture changes every 3-4 seconds: wide, medium and close shots one
// after another. One painted picture is cut the same way here: each shot is a
// framing of the picture (zoom z, centre offset x, y in % of the frame) with a
// slow drift to the next resting place. The first shot of a scene is wide.
export const SHOT_MS = 4000;
const FRAMINGS = [
  { z: 1.06, x: 0, y: 0 }, // wide
  { z: 1.38, x: -10, y: 2 }, // medium, right of the picture (RTL viewers read from there)
  { z: 1.7, x: 0, y: 5 }, // close on the middle, where people usually stand
  { z: 1.38, x: 10, y: 2 }, // medium, left
  { z: 1.5, x: -5, y: -9 }, // the upper part: sky, walls, mountains
  { z: 1.55, x: 6, y: 9 }, // the lower part: ground, hands, feet
];
// The furthest a framing may move off centre and still fill the frame.
export const shotRoom = (z) => 50 * (1 - 1 / z);
const clampShot = ({ z, x, y }) => {
  const r = shotRoom(z) - 0.2;
  return { z, x: Math.max(-r, Math.min(r, x)), y: Math.max(-r, Math.min(r, y)) };
};
// The shots of one scene: [{from, to}], from and to as {z, x, y}. Never the same
// framing twice in a row; each drifts a little (a slow push in or out, a short pan).
export function shotPlan(key, count) {
  const rnd = seeded(`shots:${key}`);
  const out = [];
  let last = -1;
  for (let i = 0; i < count; i++) {
    let k = 0;
    if (i > 0) {
      do { k = 1 + Math.floor(rnd() * (FRAMINGS.length - 1)); } while (k === last);
      if (i % 5 === 0) k = 0; // back to wide now and then, to breathe
    }
    last = k;
    const f = FRAMINGS[k];
    const push = rnd() < 0.6 ? 1 : -1;
    const dz = 0.05 * push;
    const dx = (rnd() - 0.5) * 4;
    const dy = (rnd() - 0.5) * 2;
    const a = clampShot({ z: f.z, x: f.x - dx / 2, y: f.y - dy / 2 });
    const b = clampShot({ z: Math.max(1.03, f.z + dz), x: f.x + dx / 2, y: f.y + dy / 2 });
    out.push({ from: a, to: b });
  }
  return out;
}
export const shotTransform = ({ z, x, y }) => `scale(${z.toFixed(3)}) translate3d(${x.toFixed(2)}%, ${y.toFixed(2)}%, 0)`;
