import { el } from '../util.js';
import { imageUrl } from '../media.js';
import { piLineUrl, deviceSay, stopSpeech, canSpeakLang } from '../speech.js';
import { rateFactor } from '../settings.js';
import { lineMs, filmMinutes, gateOpen, canJump, cues, subtitlePlan, subtitleAt, mood, artPlan, seeded } from '../parashaLogic.js';

// The parasha film ("פרשת שבוע"): a narrated storybook film, one painted
// picture per scene with a slow camera move, light and particles over it, the
// narration as subtitles, the verse on a parchment card and Rashi on his own
// card. Then the quiz.
//
// Pictures and narration come from the home Pi (media.js imageUrl, speech.js
// piLineUrl). Until a picture arrives (or if it never does) the scene shows a
// backdrop painted here: sky, hills and paper-cut figures, by the scene's light.
//
// The film is one exercise: {type: 'parasha_film', title_he, ref_he, scenes:
// [{id, title_he, img, move, fx, art, say: [lines], pasuk, note}]}.

const SPEEDS = [1, 1.25, 0.85];
const PREROLL = 2000; // the chapter title has the stage to itself before the narration starts
const LINE_GAP = 380;
const SCENE_GAP = 900;
const START_WAIT = 4000; // a Pi recording that has not started by now is read by the device instead
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const now = () => performance.now();

// ---- icons (drawn, not emoji, so they look the same on every device) ----
const ICONS = {
  play: '<path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11.3-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z"/>',
  pause: '<rect x="6" y="4.5" width="4.2" height="15" rx="1.2"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2"/>',
  // In RTL the film runs right to left: "back" points right, "on" points left.
  back: '<path d="M5 5.6v12.8a.9.9 0 0 0 1.4.75L15 13.4v5a1 1 0 0 0 1 1h1.6a1 1 0 0 0 1-1V5.6a1 1 0 0 0-1-1H16a1 1 0 0 0-1 1v5L6.4 4.85A.9.9 0 0 0 5 5.6z"/>',
  on: '<path d="M19 5.6v12.8a.9.9 0 0 1-1.4.75L9 13.4v5a1 1 0 0 1-1 1H6.4a1 1 0 0 1-1-1V5.6a1 1 0 0 1 1-1H8a1 1 0 0 1 1 1v5l8.6-5.75A.9.9 0 0 1 19 5.6z"/>',
  full: '<path d="M4 9V5a1 1 0 0 1 1-1h4v2.2H6.2V9zm11-5h4a1 1 0 0 1 1 1v4h-2.2V6.2H15zM4 15h2.2v2.8H9V20H5a1 1 0 0 1-1-1zm13.8 0H20v4a1 1 0 0 1-1 1h-4v-2.2h2.8z"/>',
  unfull: '<path d="M9 4v4a1 1 0 0 1-1 1H4V6.8h2.8V4zm6 0h2.2v2.8H20V9h-4a1 1 0 0 1-1-1zM4 15h4a1 1 0 0 1 1 1v4H6.8v-2.8H4zm11 1a1 1 0 0 1 1-1h4v2.2h-2.8V20H15z"/>',
  lock: '<path d="M7.5 10V8a4.5 4.5 0 0 1 9 0v2h.5a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 17 20H7a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 7 10zm2 0h5V8a2.5 2.5 0 0 0-5 0z"/>',
  replay: '<path d="M12 5a7 7 0 1 1-6.6 4.7l-1.9-.65A9 9 0 1 0 12 3V.8L7.6 4.2 12 7.6z"/>',
};
const svgNode = (markup) => { const t = document.createElement('template'); t.innerHTML = markup.trim(); return t.content.firstChild; };
const icon = (name) => svgNode(`<svg class="pf-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`);

// ---- the painted backdrop ----

// By the scene's light: sky from top to horizon, the sun or moon, three ranges
// of hills from far to near, and the colours of what stands on the ground.
const PAL = {
  night: { sky: ['#050822', '#131c55', '#3b3f8c'], orb: [1210, 180, 50, '#f7f1dc', '#b9c4ff'], hills: ['#333c8a', '#252c72', '#171c54'], fig: '#060820', stone: '#3a3f7c', wool: '#aeb7e6', warm: '#ffcf7a', stars: 46 },
  lamp: { sky: ['#160b1c', '#3a1a22', '#8a431f'], orb: null, hills: ['#5a2a1a', '#3a1a10', '#1b0a07'], fig: '#100504', stone: '#6b3a22', wool: '#e9c9a0', warm: '#ffc66a', stars: 0 },
  sunset: { sky: ['#2a1d5e', '#b3477b', '#f9a24c'], orb: [1090, 585, 92, '#ffe2a0', '#ffb347'], hills: ['#93446f', '#5c2655', '#2a1234'], fig: '#1a0a25', stone: '#6d3560', wool: '#f4cfb0', warm: '#ffd08a', stars: 8 },
  dawn: { sky: ['#3d4f9e', '#e68fa3', '#ffd89c'], orb: [430, 590, 84, '#fff3cc', '#ffc27a'], hills: ['#bd7c93', '#8b5474', '#4b2a4e'], fig: '#2b1634', stone: '#9a6a84', wool: '#ffe9d6', warm: '#ffd08a', stars: 0 },
  mist: { sky: ['#8198b8', '#c9d5df', '#f3ead9'], orb: [520, 400, 70, '#fffaf0', '#fff1d0'], hills: ['#a9b8c4', '#7b8fa0', '#4b5d6f'], fig: '#303e4c', stone: '#8b9aa6', wool: '#f6f3ea', warm: '#ffe2a8', stars: 0 },
  gold: { sky: ['#5a8dce', '#f2cc86', '#ffeab4'], orb: [800, 330, 96, '#fff8dc', '#ffd978'], hills: ['#dba862', '#b17b3d', '#6d4420'], fig: '#3a210e', stone: '#c79a5e', wool: '#fff6e0', warm: '#ffd978', stars: 0 },
  pasture: { sky: ['#4b97d8', '#a6d4ee', '#eaf4d4'], orb: [1260, 180, 68, '#fffbe2', '#fff0a8'], hills: ['#93c27e', '#60a058', '#34693a'], fig: '#1d3a23', stone: '#8f9a86', wool: '#fffdf5', warm: '#ffe9a0', stars: 0 },
  day: { sky: ['#4a90d2', '#a8d0ea', '#f7e5bc'], orb: [330, 185, 70, '#fffbe2', '#ffe9a0'], hills: ['#dfba7e', '#c39552', '#8a5e2c'], fig: '#48300f', stone: '#b98f58', wool: '#fffaf0', warm: '#ffe2a0', stars: 0 },
};

// A range of hills as one closed path; returns the path and the height at x.
function range(rnd, base, amp) {
  const waves = [0, 1, 2].map((k) => [amp * (0.62 - k * 0.2), (0.0016 + rnd() * 0.0016) * (k + 1), rnd() * 6.28]);
  const y = (x) => base + waves.reduce((n, [a, f, p]) => n + a * Math.sin(x * f + p), 0);
  let d = 'M-20,920 ';
  for (let x = -20; x <= 1620; x += 20) d += `L${x},${y(x).toFixed(1)} `;
  return { d: `${d}L1620,920Z`, y };
}

// The paper-cut figures, each drawn standing on (0,0), about 100 high.
const FIG = {
  man: (c) => `<path fill="${c.fig}" d="M-17,0 L-11,-61 Q-11,-72 -9,-76 L-11,-83 Q-11,-97 0,-97 Q11,-97 11,-83 L9,-76 Q11,-72 11,-61 L17,0Z"/><path d="M8,-62 L23,-50 M24,-86 L24,0" stroke="${c.fig}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
  woman: (c) => `<path fill="${c.fig}" d="M-21,0 L-12,-58 L-15,-62 L-11,-84 Q-11,-97 0,-97 Q11,-97 11,-84 L15,-62 L12,-58 L21,0Z"/>`,
  child: (c) => `<g transform="scale(.6)"><path fill="${c.fig}" d="M-18,0 L-11,-60 Q-11,-72 -9,-76 L-10,-84 Q-10,-96 0,-96 Q10,-96 10,-84 L9,-76 Q11,-72 11,-60 L18,0Z"/></g>`,
  sleeper: (c) => `<ellipse cx="-58" cy="-5" rx="17" ry="8" fill="${c.stone}"/><path fill="${c.fig}" d="M-44,-8 Q-20,-24 20,-16 Q52,-12 62,-2 L62,0 L-44,0Z"/><circle cx="-52" cy="-17" r="9" fill="${c.fig}"/>`,
  tent: (c) => `<path fill="${c.tent}" d="M-104,0 L-6,-118 L0,-128 L6,-118 L104,0Z"/><path fill="${c.fig}" opacity=".55" d="M30,0 L0,-118 L104,0Z"/><path fill="${c.door}" d="M-22,0 L0,-66 L16,0Z"/><path d="M0,-128 L0,-142" stroke="${c.fig}" stroke-width="3" stroke-linecap="round"/>`,
  stone: (c) => `<path fill="${c.stone}" d="M-21,0 Q-29,-58 -11,-88 Q4,-104 18,-86 Q31,-52 24,0Z"/><path fill="${c.fig}" opacity=".35" d="M4,0 Q14,-52 6,-97 Q14,-98 18,-86 Q31,-52 24,0Z"/><ellipse cx="-44" cy="-7" rx="17" ry="10" fill="${c.stone}"/><ellipse cx="46" cy="-6" rx="13" ry="8" fill="${c.stone}"/>`,
  well: (c) => `<path fill="${c.stone}" d="M-62,-44 L-62,0 Q0,16 62,0 L62,-44Z"/><ellipse cx="0" cy="-44" rx="62" ry="15" fill="${c.stone}"/><ellipse cx="0" cy="-44" rx="48" ry="10" fill="${c.fig}" opacity=".8"/><path fill="${c.fig}" opacity=".3" d="M20,-30 L62,-44 L62,0 Q40,8 20,10Z"/>`,
  house: (c) => `<path fill="${c.tent}" d="M-120,0 L-120,-150 L20,-150 L20,-104 L120,-104 L120,0Z"/><path fill="${c.fig}" opacity=".4" d="M20,-104 L120,-104 L120,0 L20,0Z"/><path fill="${c.door}" d="M-74,0 L-74,-52 Q-56,-74 -38,-52 L-38,0Z"/><rect x="-8" y="-122" width="14" height="20" rx="6" fill="${c.door}"/><rect x="58" y="-78" width="14" height="20" rx="6" fill="${c.door}"/>`,
  sheep: (c, wool) => `<path d="M-11,-12 L-11,0 M9,-12 L9,0" stroke="${c.fig}" stroke-width="3.4" stroke-linecap="round"/><ellipse cx="0" cy="-20" rx="19" ry="12" fill="${wool}"/><circle cx="-12" cy="-27" r="8" fill="${wool}"/><circle cx="0" cy="-30" r="9" fill="${wool}"/><circle cx="11" cy="-27" r="8" fill="${wool}"/><ellipse cx="21" cy="-24" rx="7" ry="6" fill="${c.fig}"/>`,
};
const SCALE = { man: 2, woman: 1.9, child: 1.9, sleeper: 1.9, tent: 1.25, stone: 1.5, well: 1.35, house: 1.3, sheep: 1.5, goat: 1.5 };
const SLOTS = { 1: [0.5], 2: [0.4, 0.69], 3: [0.5, 0.23, 0.78], 4: [0.42, 0.63, 0.19, 0.84] };
const PEOPLE = ['man', 'woman', 'child', 'sleeper'];

let uid = 0;
function paint(scene) {
  const m = mood(scene);
  const p = PAL[m];
  const rnd = seeded(scene.id || scene.title_he || 'x');
  const id = `pf${++uid}`;
  const night = m === 'night' || m === 'lamp';
  const c = { fig: p.fig, stone: p.stone, tent: p.hills[1], door: night || m === 'sunset' ? p.warm : p.fig };
  const far = range(rnd, 520, 62);
  const mid = range(rnd, 612, 40);
  const near = range(rnd, 704, 15);
  let stars = '';
  for (let i = 0; i < p.stars; i++) stars += `<circle cx="${(rnd() * 1600).toFixed(0)}" cy="${(rnd() * 520).toFixed(0)}" r="${(0.8 + rnd() * 1.5).toFixed(1)}" fill="#fff" opacity="${(0.35 + rnd() * 0.6).toFixed(2)}"/>`;
  // Light from above (never a figure): the sun itself is out of the picture, over its top edge.
  const o = scene.noOrb ? null : scene.fx === 'light' && !night ? [800, -60, 150, p.orb[3], p.orb[4]] : p.orb;
  const orb = o ? `<circle cx="${o[0]}" cy="${o[1]}" r="${o[2] * 5}" fill="url(#${id}g)"/><circle cx="${o[0]}" cy="${o[1]}" r="${o[2]}" fill="${o[3]}"/>` : '';
  // Inside the lamp-lit tent: the folds of the cloth and three hanging lamps instead of a sky.
  const drapes = m === 'lamp' ? [-520, -260, 0, 260, 520].map((dx) => `<path d="M800,-40 Q${800 + dx * 0.7},260 ${800 + dx * 1.5},640" stroke="#000" stroke-opacity=".22" stroke-width="26" fill="none"/>`).join('')
    + [380, 800, 1220].map((x, k) => `<circle cx="${x}" cy="${250 - (k === 1 ? 40 : 0)}" r="210" fill="url(#${id}l)"/><path d="M${x},-10 L${x},${222 - (k === 1 ? 40 : 0)}" stroke="#1b0a07" stroke-width="3"/><ellipse cx="${x}" cy="${238 - (k === 1 ? 40 : 0)}" rx="20" ry="12" fill="#2a120a"/><ellipse cx="${x}" cy="${222 - (k === 1 ? 40 : 0)}" rx="7" ry="13" fill="#ffe7a8"/>`).join('') : '';
  const back = `<svg class="pf-back" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset=".55" stop-color="${p.sky[1]}"/><stop offset="1" stop-color="${p.sky[2]}"/></linearGradient>
      <radialGradient id="${id}g"><stop offset="0" stop-color="${p.orb ? p.orb[4] : '#fff'}" stop-opacity=".75"/><stop offset=".35" stop-color="${p.orb ? p.orb[4] : '#fff'}" stop-opacity=".22"/><stop offset="1" stop-color="${p.orb ? p.orb[4] : '#fff'}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}l"><stop offset="0" stop-color="#ffd27a" stop-opacity=".7"/><stop offset=".4" stop-color="#ff9d3c" stop-opacity=".22"/><stop offset="1" stop-color="#ff9d3c" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[2]}" stop-opacity="0"/><stop offset="1" stop-color="${p.sky[2]}" stop-opacity=".55"/></linearGradient>
    </defs>
    <rect x="-20" y="-20" width="1640" height="940" fill="url(#${id}s)"/>${stars}${orb}${drapes}
    <path d="${far.d}" fill="${p.hills[0]}"/><rect x="-20" y="430" width="1640" height="200" fill="url(#${id}h)"/>
    <path d="${mid.d}" fill="${p.hills[1]}"/><rect x="-20" y="570" width="1640" height="150" fill="url(#${id}h)" opacity=".6"/>
  </svg>`;

  // What stands on the near ground: people in the middle, the rest around them.
  const items = artPlan(scene.art).sort((a, b) => PEOPLE.includes(b.kind) - PEOPLE.includes(a.kind));
  const slots = SLOTS[items.length] || [];
  let figs = '';
  const spans = [];
  const ladderAt = items.findIndex((it) => it.kind === 'ladder');
  items.forEach((it, i) => {
    // The ladder stands clear of the moon, and the dreamer sleeps at its foot.
    const x = it.kind === 'ladder' ? 900 : it.kind === 'sleeper' && ladderAt >= 0 ? 660 : slots[i] * 1600 + (rnd() - 0.5) * 40;
    const y = near.y(x) + 8;
    const s = (SCALE[it.kind] || 1) * (i === 0 ? 1.12 : 1);
    const at = (dx, k = 1, flip = false) => `translate(${(x + dx).toFixed(0)},${(near.y(x + dx) + 8).toFixed(0)}) scale(${(flip ? -s : s) * k},${s * k})`;
    if (it.kind === 'ladder') {
      const top = 70;
      let rungs = '';
      for (let k = 1; k < 15; k++) { const t = k / 15; const yy = y - (y - top) * t; const w = 46 - 26 * t; const cx = x + 44 * t; rungs += `M${(cx - w).toFixed(1)},${yy.toFixed(1)} L${(cx + w).toFixed(1)},${yy.toFixed(1)} `; }
      const rails = `M${x - 46},${y} L${x + 24},${top} M${x + 46},${y} L${x + 64},${top}`;
      figs += `<circle cx="${x + 44}" cy="${top + 10}" r="330" fill="url(#${id}n)"/><g class="pf-ladder" fill="none" stroke-linecap="round"><path d="${rails} ${rungs}" stroke="#ffd778" stroke-opacity=".28" stroke-width="20"/><path d="${rails} ${rungs}" stroke="#fff3c4" stroke-width="5.5"/></g>`;
    } else if (it.kind === 'sheep' || it.kind === 'goat') {
      const wool = it.kind === 'goat' ? p.hills[2] : p.wool;
      const n = Math.min(7, 3 + it.count * 2);
      for (let k = 0; k < n; k++) figs += `<g transform="${at((k - (n - 1) / 2) * 62 + (rnd() - 0.5) * 22, 0.8 + rnd() * 0.45, rnd() < 0.4)}">${FIG.sheep(c, wool)}</g>`;
    } else if (it.kind === 'emoji') {
      for (let k = 0; k < Math.min(2, it.count); k++) spans.push(el('span', { class: 'pf-sil', style: `left:${((x + k * 190) / 16).toFixed(1)}%; top:${((near.y(x + k * 190) + 14) / 9).toFixed(1)}%; --k:${k ? 0.8 : 1}` }, it.e));
    } else if (FIG[it.kind]) {
      figs += `<g transform="${at(0)}">${FIG[it.kind](c)}</g>`;
      if (it.kind === 'stone' && it.count > 1) figs += [[-96, 0.5], [84, 0.42], [-150, 0.3], [132, 0.3]].map(([dx, k]) => `<g transform="${at(dx, k)}">${FIG.stone(c)}</g>`).join('');
      if (it.kind === 'tent') figs += `<g transform="${at(170, 0.66)}">${FIG.tent(c)}</g>`;
      if (it.kind === 'child') figs += `<g transform="${at(-70, 0.8)}">${FIG.child(c)}</g><g transform="${at(64, 1.15)}">${FIG.child(c)}</g>`;
    }
  });
  const front = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><radialGradient id="${id}n"><stop offset="0" stop-color="#fff6d0" stop-opacity=".8"/><stop offset=".3" stop-color="#ffd778" stop-opacity=".25"/><stop offset="1" stop-color="#ffd778" stop-opacity="0"/></radialGradient></defs>
    <path d="${near.d}" fill="${p.hills[2]}"/>${figs}</svg>`;
  return el('div', { class: `pf-paint pf-m-${m}` }, svgNode(back), el('div', { class: 'pf-near' }, svgNode(front), ...spans));
}

// The light and particles over a scene. Few elements, only transform and opacity move.
function effects(fx, rnd) {
  const dots = (cls, n, box = [0, 100, 0, 100]) => Array.from({ length: n }, (_, i) => el('i', {
    class: cls,
    style: `left:${(box[0] + rnd() * (box[1] - box[0])).toFixed(1)}%; top:${(box[2] + rnd() * (box[3] - box[2])).toFixed(1)}%; --s:${(0.6 + rnd() * 0.9).toFixed(2)}; --d:${(-rnd() * 9).toFixed(1)}s; --t:${(5 + rnd() * 6).toFixed(1)}s; --i:${i}`,
  }));
  const layer = (...kids) => el('div', { class: `pf-fx pf-fx-${fx}`, 'aria-hidden': 'true' }, ...kids);
  const stars = (n) => [0, 1, 2].map((k) => el('div', { class: `pf-twinkle t${k}` }, ...dots('pf-star', n, [2, 98, 3, 58])));
  switch (fx) {
    case 'stars': return layer(...stars(8));
    case 'night': return layer(el('div', { class: 'pf-lampglow' }), ...dots('pf-mote', 5, [10, 90, 30, 80]));
    case 'light': return layer(el('div', { class: 'pf-glow' }), el('div', { class: 'pf-rays' }, ...[-34, -17, -3, 12, 29].map((a, i) => el("i", { style: `--a:${a}deg; --w:${[7, 11, 15, 9, 12][i]}; --d:${-i * 1.7}s` }))), ...dots('pf-mote', 5, [20, 80, 15, 70]));
    case 'dust': return layer(el('div', { class: 'pf-haze' }), ...dots('pf-mote', 10, [0, 95, 25, 95]));
    case 'mist': return layer(el('div', { class: 'pf-mist a' }), el('div', { class: 'pf-mist b' }));
    case 'sparkle': return layer(...dots('pf-spark', 7, [8, 92, 34, 82]));
    case 'sunset': return layer(el('div', { class: 'pf-warm' }), ...dots('pf-mote', 6, [5, 95, 35, 90]));
    default: return layer();
  }
}

// ---- what the device remembers: how far this film was watched ----
const STORE = 'parashaFilm';
function loadSeen(key) {
  try { const all = JSON.parse(localStorage.getItem(STORE) || '{}'); return all[key] || null; } catch { return null; }
}
function saveSeen(key, rec) {
  try { const all = JSON.parse(localStorage.getItem(STORE) || '{}'); all[key] = rec; localStorage.setItem(STORE, JSON.stringify(all)); } catch { /* private mode */ }
}

export function renderParashaFilm(root, ex, { setReady, track, learnerId } = {}) {
  const scenes = (ex.scenes || []).filter((s) => s && (s.say || []).length);
  const total = scenes.length;
  const lesson = root.closest('.lesson');
  const key = `${learnerId ? `${learnerId}:` : ''}${ex.id || ex.title_he || 'film'}:${total}`;
  const seen = loadSeen(key);

  let at = -1; // -1: title card; total: end card
  let line = 0;
  let playing = false;
  let alive = true;
  let gen = 0; // every stop makes the callbacks of what was playing stale
  let cur = { kind: 'none' };
  let startTimer = 0;
  let started = false;
  let ready = !!seen?.done || total === 0;
  const played = new Set(seen?.played || []);
  let furthest = seen?.done ? total : Math.min(total - 1, Math.max(0, seen?.far || 0));
  let speed = 1;
  try { const s = Number(localStorage.getItem('parashaSpeed')); if (SPEEDS.includes(s)) speed = s; } catch { /* default */ }
  const remember = () => saveSeen(key, { far: furthest, played: [...played], done: ready && (seen?.done || at >= total || played.size >= total) });
  const open = () => { if (!ready) { ready = true; setReady?.(true); } };

  // ---- the stage ----
  const sceneLayer = el('div', { class: 'pf-scenes' });
  const chapter = el('div', { class: 'pf-chapter', 'aria-hidden': 'true' });
  const subs = el('div', { class: 'pf-subs', 'aria-live': 'off' });
  const ovPasuk = el('div', { class: 'pf-ov pf-ov-pasuk', 'aria-hidden': 'true' });
  const ovNote = el('div', { class: 'pf-ov pf-ov-note', 'aria-hidden': 'true' });
  const badge = el('div', { class: 'pf-badge', 'aria-hidden': 'true' }, icon('play'));
  const cardLayer = el('div', { class: 'pf-cards' });
  const stage = el('div', { class: 'pf-stage' }, sceneLayer, el('div', { class: 'pf-vignette', 'aria-hidden': 'true' }), ovPasuk, ovNote, chapter, subs, badge, cardLayer);

  // ---- the controls ----
  const btn = (cls, label, ico, onclick) => el('button', { class: `pf-btn ${cls}`, type: 'button', 'aria-label': label, title: label, onclick }, icon(ico));
  const segs = el('div', { class: 'pf-segs', 'aria-hidden': 'true' }, scenes.map(() => el('i', {}, el('b'))));
  const playBtn = btn('pf-play', 'ניגון', 'play', () => toggle());
  const backBtn = btn('pf-back-btn', 'הפרק הקודם', 'back', () => { track?.('back', ''); jump(at - 1); });
  const onBtn = btn('pf-on-btn', 'הפרק הבא', 'on', () => { track?.('skip', ''); jump(at + 1); });
  const metaTitle = el('span', { class: 'pf-meta-title' }, ex.title_he || '');
  const metaCount = el('span', { class: 'pf-meta-count' });
  const speedBtn = el('button', { class: 'pf-btn pf-speed', type: 'button', 'aria-label': 'מהירות ההקראה', title: 'מהירות ההקראה', onclick: () => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]) });
  const fullBtn = btn('pf-full', 'מסך מלא', 'full', () => toggleFull());
  const controls = el('div', { class: 'pf-controls' }, segs,
    el('div', { class: 'pf-row' },
      el('div', { class: 'pf-transport' }, backBtn, playBtn, onBtn),
      el('div', { class: 'pf-meta' }, metaTitle, metaCount),
      el('div', { class: 'pf-tools' }, speedBtn, fullBtn)));
  const frame = el('div', { class: 'pf-frame', dir: 'rtl' }, stage, controls);

  const chips = el('div', { class: 'pf-chips', role: 'list', 'aria-label': 'פרקי הסרט' }, scenes.map((s, i) => el('button', {
    class: 'pf-chip', type: 'button', role: 'listitem', onclick: () => { track?.('scene', i + 1); jump(i); },
  }, el('span', { class: 'pf-chip-n' }, String(i + 1)), el('span', { class: 'pf-chip-t' }, s.title_he || ''), icon('lock'))));
  const shelf = el('div', { class: 'pf-shelf', 'aria-live': 'polite' });
  const film = el('div', { class: 'pf' }, frame, chips, shelf);

  const pasukCard = (p) => [el('span', { class: 'pf-pasuk-text' }, p.text), el('span', { class: 'pf-pasuk-ref' }, p.ref || '')];
  const noteCard = (n) => [el('span', { class: 'pf-note-who' }, el('span', { class: 'pf-note-ico', 'aria-hidden': 'true' }, '💡'), n.who || ''), el('span', { class: 'pf-note-text' }, n.text)];

  // ---- pictures ----
  const pics = scenes.map(() => ({ state: 'idle', img: null, tries: 0 }));
  const sceneEls = new Map();
  const placePic = (i) => {
    const node = sceneEls.get(i);
    const pic = pics[i];
    if (!node || pic.state !== 'ok' || node.querySelector('.pf-pic')) return;
    const img = el('img', { class: 'pf-pic', alt: '', draggable: 'false', src: pic.img.src });
    node.querySelector('.pf-cam').append(img);
    // Laid out first, then faded in over the painted backdrop.
    requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('has-pic')));
  };
  const loadPic = async (i) => {
    const pic = pics[i];
    if (!pic || pic.state === 'ok' || pic.state === 'loading' || pic.tries >= 3) return;
    pic.state = 'loading';
    pic.tries += 1;
    const url = await imageUrl(scenes[i].img).catch(() => null);
    if (!alive) return;
    if (!url) { pic.state = 'none'; pic.tries = 3; return; }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { pic.state = 'ok'; pic.img = img; if (alive) placePic(i); };
    img.onerror = () => { pic.state = 'fail'; };
    img.src = pic.tries > 1 ? `${url}&r=${pic.tries}` : url;
  };
  const preload = (i) => { for (let k = i; k <= i + 2 && k < total; k++) if (k >= 0) loadPic(k); };

  // Asks the Pi to prepare narration ahead, one line at a time.
  const warmed = new Set();
  let warming = false;
  const warmQueue = [];
  const warm = (i) => {
    if (i < 0 || i >= total || warmed.has(i)) return;
    warmed.add(i);
    warmQueue.push(...scenes[i].say);
    if (warming) return;
    warming = true;
    (async () => {
      while (alive && warmQueue.length) {
        const url = await piLineUrl(warmQueue.shift(), 'he-IL').catch(() => null);
        if (!url) { warmQueue.length = 0; break; }
        const res = await fetch(`${url}&warm=1`).catch(() => null);
        if (!res || res.status === 404) { warmQueue.length = 0; break; }
      }
      warming = false;
    })();
  };

  // ---- a scene on the stage ----
  const buildScene = (i) => {
    const s = scenes[i];
    const ms = s.say.reduce((n, t) => n + lineMs(t) + LINE_GAP, PREROLL) / speed;
    const node = el('div', { class: `pf-scene pf-move-${['in', 'out', 'left', 'right', 'up'].includes(s.move) ? s.move : 'in'}`, style: `--dur:${Math.round(Math.max(14000, ms))}ms` },
      el('div', { class: 'pf-cam' }, paint(s)),
      reducedMotion() ? null : effects(s.fx, seeded(`${s.id}fx`)));
    return node;
  };
  const showScene = (i) => {
    for (const [k, node] of sceneEls) {
      if (node.classList.contains('out')) { node.remove(); if (sceneEls.get(k) === node) sceneEls.delete(k); } else { node.classList.add('out'); const dead = node; setTimeout(() => { dead.remove(); if (sceneEls.get(k) === dead) sceneEls.delete(k); }, 1400); }
    }
    const node = buildScene(i);
    sceneEls.set(i, node);
    sceneLayer.append(node);
    placePic(i);
    if (pics[i].state === 'fail') loadPic(i);
    requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('in')));
  };

  // ---- subtitles ----
  let plan = [];
  let shown = { chunk: -1, word: -1 };
  const setLine = (text) => {
    plan = subtitlePlan(text, stage.clientWidth < 560 ? 54 : 76);
    shown = { chunk: -1, word: -1 };
    paintSubs(0);
  };
  const paintSubs = (frac) => {
    const { chunk, word } = subtitleAt(plan, frac);
    if (chunk < 0) { subs.replaceChildren(); return; }
    if (chunk !== shown.chunk) {
      subs.replaceChildren(el('p', { class: 'pf-sub' }, ...plan[chunk].words.flatMap((x, k) => [k ? ' ' : null, el('span', { class: 'w' }, x.w)])));
      shown = { chunk, word: -1 };
    }
    if (word !== shown.word) {
      const ws = subs.querySelectorAll('.w');
      ws.forEach((w, k) => { w.classList.toggle('said', k < word); w.classList.toggle('on', k === word); });
      shown.word = word;
    }
  };
  const fracNow = () => {
    if (cur.kind === 'audio') {
      const d = audio.duration;
      return Number.isFinite(d) && d > 0 ? audio.currentTime / d : (audio.currentTime * 1000) / cur.est;
    }
    if (cur.kind === 'timer') return (cur.done + (playing ? (now() - cur.t0) * speed : 0)) / cur.est;
    if (cur.kind === 'device') return Math.min(0.97, ((now() - cur.t0) * speed) / (cur.est * 1.08));
    if (cur.kind === 'gap' && cur.after) return 1;
    return 0;
  };
  const tick = () => {
    if (at < 0 || at >= total) return;
    const f = Math.min(1, Math.max(0, fracNow()));
    if (cur.kind !== 'gap' && cur.kind !== 'none') paintSubs(f);
    const n = scenes[at].say.length;
    segs.children[at]?.style.setProperty('--p', Math.min(1, (line + (cur.kind === 'gap' && !cur.after ? 0 : f)) / n).toFixed(3));
  };
  const ticker = setInterval(() => { if (playing) tick(); }, 110);

  // ---- the cards: the verse and Rashi ----
  let cue = { pasukLine: -1, noteLine: -1 };
  const setCards = (i) => {
    const s = scenes[i];
    cue = cues(s);
    frame.classList.remove('pasuk-on', 'note-on');
    ovPasuk.replaceChildren(...(s.pasuk ? pasukCard(s.pasuk) : []));
    ovNote.replaceChildren(...(s.note ? noteCard(s.note) : []));
    const again = played.has(i);
    shelf.replaceChildren(...[
      s.pasuk ? el('div', { class: `pf-card pf-card-pasuk${again ? ' on' : ''}` }, ...pasukCard(s.pasuk)) : null,
      s.note ? el('div', { class: `pf-card pf-card-note${again ? ' on' : ''}` }, ...noteCard(s.note)) : null].filter(Boolean));
  };
  const cardsAt = (ln) => {
    const p = cue.pasukLine;
    const n = cue.noteLine;
    // On the picture the verse stays for its line and the next one, and makes way for Rashi.
    const noteOn = n >= 0 && ln >= n;
    frame.classList.toggle('pasuk-on', p >= 0 && ln >= p && ln <= p + 1 && !noteOn);
    frame.classList.toggle('note-on', noteOn);
    // Under the picture (narrow screens) a card stays once it has come.
    if (p >= 0 && ln >= p) shelf.querySelector('.pf-card-pasuk')?.classList.add('on');
    if (noteOn) shelf.querySelector('.pf-card-note')?.classList.add('on');
  };

  // ---- narration ----
  const audio = new Audio();
  audio.preload = 'auto';
  audio.onplaying = () => { if (cur.kind === 'audio') { cur.started = true; clearTimeout(startTimer); frame.classList.remove('waiting'); } };
  audio.onended = () => { if (cur.kind === 'audio') lineDone(); };
  audio.onerror = () => { if (cur.kind === 'audio') toDevice(); };
  audio.onloadedmetadata = () => { audio.playbackRate = speed; };

  // Runs fn after ms unless playback was stopped or moved on meanwhile.
  const wait = (ms, fn) => { const g = gen; setTimeout(() => { if (alive && g === gen && playing) fn(); }, ms); };
  const quiet = () => {
    gen += 1;
    clearTimeout(startTimer);
    const was = cur.kind;
    cur = { kind: 'none' };
    frame.classList.remove('waiting');
    if (was === 'audio') { try { audio.pause(); } catch { /* not started */ } }
    if (was === 'device') stopSpeech();
  };
  const armStart = () => { clearTimeout(startTimer); startTimer = setTimeout(() => { if (cur.kind === 'audio' && !cur.started && playing) toDevice(); }, START_WAIT); };

  const startLine = async () => {
    quiet();
    const g = gen;
    const s = scenes[at];
    if (!s) return;
    if (line >= s.say.length) { sceneDone(); return; }
    const text = s.say[line];
    setLine(text);
    cardsAt(line);
    cur = { kind: 'loading' };
    const url = await piLineUrl(text, 'he-IL').catch(() => null);
    if (!alive || g !== gen || !playing) return;
    if (!url) { playDevice(text); return; }
    cur = { kind: 'audio', est: lineMs(text), text, started: false };
    frame.classList.add('waiting');
    audio.src = url;
    audio.defaultPlaybackRate = speed;
    audio.playbackRate = speed;
    armStart();
    audio.play().catch((e) => { if (g === gen && cur.kind === 'audio' && e?.name !== 'AbortError') toDevice(); });
  };
  const toDevice = () => {
    const text = cur.text;
    quiet();
    if (playing && text) playDevice(text);
  };
  // The device's own voice. One that ends at once is no voice at all: the line then gets its reading time.
  const playDevice = (text) => {
    const est = lineMs(text);
    if (!canSpeakLang('he-IL')) { runTimer(est, 0); return; }
    const g = gen;
    cur = { kind: 'device', est, text, t0: now() };
    deviceSay(text, 'he-IL', 0.95 * rateFactor() * speed).catch(() => {}).then(() => {
      if (!alive || g !== gen) return;
      const took = now() - cur.t0;
      if (took < Math.min(1500, est * 0.3)) runTimer(est, took * speed); else lineDone();
    });
  };
  const runTimer = (est, done) => {
    cur = { kind: 'timer', est, done, t0: now() };
    wait(Math.max(0, (est - done) / speed), lineDone);
  };
  const lineDone = () => {
    quiet();
    paintSubs(1);
    subs.querySelectorAll('.w').forEach((w) => { w.classList.add('said'); w.classList.remove('on'); });
    line += 1;
    const last = line >= scenes[at].say.length;
    if (last) {
      // The whole scene was narrated: it counts toward opening the quiz.
      played.add(at);
      furthest = Math.min(total - 1, Math.max(furthest, at + 1));
      if (gateOpen(played.size, total)) open();
      remember();
      paintNav();
    }
    cur = { kind: 'gap', after: true, next: last ? () => go(at + 1, true) : startLine };
    tick();
    wait(last ? SCENE_GAP : LINE_GAP, cur.next);
  };
  const sceneDone = () => go(at + 1, true);

  // ---- moving through the film ----
  const setPlaying = (on) => {
    playing = on;
    playBtn.replaceChildren(icon(on ? 'pause' : 'play'));
    playBtn.setAttribute('aria-label', on ? 'השהיה' : 'ניגון');
    playBtn.title = on ? 'השהיה' : 'ניגון';
    frame.classList.toggle('paused', !on);
    frame.classList.toggle('playing', on);
    if (on) wake();
  };
  const paintNav = () => {
    const inFilm = at >= 0 && at < total;
    [...segs.children].forEach((sg, k) => {
      sg.classList.toggle('seen', k < at || at >= total);
      sg.classList.toggle('now', k === at);
      if (k !== at) sg.style.removeProperty('--p');
    });
    [...chips.children].forEach((ch, k) => {
      const locked = !canJump(k, furthest, total);
      ch.classList.toggle('now', k === at);
      ch.classList.toggle('seen', played.has(k));
      ch.classList.toggle('locked', locked);
      ch.disabled = locked;
      ch.setAttribute('aria-label', `פרק ${k + 1}: ${scenes[k].title_he || ''}${locked ? ' (נעול עד שמגיעים אליו)' : ''}`);
      if (k === at) ch.setAttribute('aria-current', 'true'); else ch.removeAttribute('aria-current');
    });
    backBtn.disabled = at <= 0 && at < total;
    onBtn.disabled = !inFilm || (at + 1 < total ? !canJump(at + 1, furthest, total) : !played.has(at));
    metaTitle.textContent = inFilm ? scenes[at].title_he || '' : ex.title_he || '';
    metaCount.textContent = inFilm ? `פרק ${at + 1} מתוך ${total}` : at >= total ? 'סוף הסרט' : `${total} פרקים`;
    const chip = chips.children[at];
    if (chip) chips.scrollTo({ left: chip.offsetLeft - (chips.clientWidth - chip.offsetWidth) / 2, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  const go = (i, play = playing) => {
    quiet();
    if (!alive) return;
    cardLayer.replaceChildren();
    frame.classList.remove('at-title', 'at-end');
    if (i >= total) { end(); return; }
    at = Math.max(0, i);
    line = 0;
    if (!started) { started = true; track?.('play', ''); }
    furthest = Math.max(furthest, at);
    showScene(at);
    preload(at);
    warm(at); warm(at + 1);
    setCards(at);
    subs.replaceChildren();
    chapter.replaceChildren(el('span', { class: 'pf-chapter-n' }, `פרק ${at + 1}`), el('span', { class: 'pf-chapter-t' }, scenes[at].title_he || ''));
    chapter.classList.remove('run');
    void chapter.offsetWidth;
    chapter.classList.add('run');
    setPlaying(play);
    paintNav();
    remember();
    cur = { kind: 'gap', next: startLine };
    if (play) wait(PREROLL, startLine);
  };
  // The buttons and chips: only as far as the film has already reached.
  const jump = (i) => {
    if (i >= total) { if (played.has(total - 1) || seen?.done) go(total); return; }
    if (at >= total && i < 0) return;
    if (!canJump(Math.max(0, i), furthest, total)) return;
    go(Math.max(0, i), at >= 0 && at < total ? playing : true);
  };
  const pause = () => {
    if (!playing) return;
    setPlaying(false);
    clearTimeout(startTimer);
    if (cur.kind === 'audio') { try { audio.pause(); } catch { /* not started */ } return; }
    if (cur.kind === 'timer') { const c = cur; gen += 1; c.done += (now() - c.t0) * speed; return; }
    // The device's voice can't be paused: it is stopped, and reads the line again on resume.
    if (cur.kind === 'device') { quiet(); cur = { kind: 'gap', next: startLine }; return; }
    gen += 1;
  };
  const resume = () => {
    if (at < 0) { begin(0); return; }
    if (at >= total) { track?.('replay', ''); go(0, true); return; }
    setPlaying(true);
    if (cur.kind === 'audio') { armStart(); audio.play().catch(() => { if (cur.kind === 'audio') toDevice(); }); return; }
    if (cur.kind === 'timer') { runTimer(cur.est, cur.done); return; }
    if (cur.kind === 'gap' && cur.next) { cur.next(); return; }
    startLine();
  };
  const toggle = () => (playing ? pause() : resume());

  const setSpeed = (v) => {
    if (cur.kind === 'timer' && playing) { const c = cur; gen += 1; c.done += (now() - c.t0) * speed; speed = v; runTimer(c.est, c.done); } else speed = v;
    audio.defaultPlaybackRate = v;
    audio.playbackRate = v;
    speedBtn.textContent = `×${String(v).replace(/^0/, '')}`;
    speedBtn.classList.toggle('changed', v !== 1);
    try { localStorage.setItem('parashaSpeed', String(v)); } catch { /* private mode */ }
  };

  // ---- the title and end cards ----
  const titleBackdrop = () => el('div', { class: 'pf-card-back', 'aria-hidden': 'true' }, paint({ id: `${ex.id || 'film'}-title`, fx: 'stars', art: '', img: 'night', noOrb: true }), reducedMotion() ? null : effects('stars', seeded('title')));
  const rule = () => el('span', { class: 'pf-rule', 'aria-hidden': 'true' }, el('i'), el('b'), el('i'));
  const showTitle = () => {
    frame.classList.add('at-title');
    const resumeAt = !seen?.done && furthest > 0 ? furthest : 0;
    const card = el('div', { class: 'pf-title' }, titleBackdrop(),
      el('div', { class: 'pf-title-body' },
        el('span', { class: 'pf-kicker' }, 'פרשת השבוע'),
        el('h2', { class: 'pf-title-text' }, el('span', {}, ex.title_he || '')),
        rule(),
        el('span', { class: 'pf-title-ref' }, ex.ref_he || ''),
        el('div', { class: 'pf-title-actions' },
          el('button', { class: 'pf-cta', type: 'button', onclick: (e) => { e.stopPropagation(); begin(0); } }, icon('play'), el('span', {}, seen?.done ? 'לצפות שוב' : 'לצפייה בסרט')),
          resumeAt ? el('button', { class: 'pf-cta ghost', type: 'button', onclick: (e) => { e.stopPropagation(); begin(resumeAt); } }, el('span', {}, `להמשיך מפרק ${resumeAt + 1}`)) : null),
        el('span', { class: 'pf-title-meta' }, `${total} פרקים · כ־${filmMinutes(scenes)} דקות`)));
    cardLayer.replaceChildren(card);
  };
  // The opening: a sweep of light over the title, then the first scene fades in.
  const begin = (from) => {
    if (started && at >= 0) return;
    const card = cardLayer.querySelector('.pf-title');
    if (card?.classList.contains('go')) return;
    if (!started) { started = true; track?.('play', ''); }
    preload(from); warm(from);
    card?.classList.add('go');
    setPlaying(true);
    cur = { kind: 'gap', next: () => go(from, true) };
    wait(reducedMotion() ? 700 : 3300, cur.next);
  };
  const end = () => {
    at = total;
    line = 0;
    furthest = total - 1;
    setPlaying(false);
    frame.classList.add('at-end');
    frame.classList.remove('pasuk-on', 'note-on');
    subs.replaceChildren();
    chapter.classList.remove('run');
    shelf.replaceChildren();
    cardLayer.replaceChildren(el('div', { class: 'pf-end' },
      el('div', { class: 'pf-end-body' },
        el('span', { class: 'pf-kicker' }, ex.title_he || ''),
        el('h2', { class: 'pf-end-text' }, 'סוף!'),
        rule(),
        el('span', { class: 'pf-end-sub' }, 'עכשיו כמה שאלות על מה שראינו'),
        el('button', { class: 'pf-cta ghost', type: 'button', onclick: () => { track?.('replay', ''); go(0, true); } }, icon('replay'), el('span', {}, 'לצפות שוב')))));
    open();
    remember();
    paintNav();
    lesson?.classList.add('story-done');
    exitFull();
  };

  // ---- full screen ----
  const isFull = () => document.fullscreenElement === frame || frame.classList.contains('pseudo-full');
  const paintFull = () => {
    const on = isFull();
    frame.classList.toggle('is-full', on);
    fullBtn.replaceChildren(icon(on ? 'unfull' : 'full'));
    fullBtn.setAttribute('aria-label', on ? 'יציאה ממסך מלא' : 'מסך מלא');
    fullBtn.title = on ? 'יציאה ממסך מלא' : 'מסך מלא';
    if (!on) { try { screen.orientation?.unlock?.(); } catch { /* not locked */ } }
    wake();
  };
  // Where the browser has no full screen for elements (iPhone), the film fills the window instead.
  const pseudo = (on) => { frame.classList.toggle('pseudo-full', on); document.documentElement.classList.toggle('pf-noscroll', on); paintFull(); };
  const exitFull = () => {
    if (document.fullscreenElement === frame) document.exitFullscreen?.().catch(() => {});
    if (frame.classList.contains('pseudo-full')) pseudo(false);
  };
  const toggleFull = () => {
    if (isFull()) { exitFull(); return; }
    const req = frame.requestFullscreen || frame.webkitRequestFullscreen;
    if (!req) { pseudo(true); return; }
    try {
      Promise.resolve(req.call(frame)).then(() => { try { screen.orientation?.lock?.('landscape')?.catch?.(() => {}); } catch { /* not supported */ } }).catch(() => pseudo(true));
    } catch { pseudo(true); }
  };
  const onFullChange = () => paintFull();
  document.addEventListener('fullscreenchange', onFullChange);

  // In full screen the controls step aside while the film plays, and come back on any touch.
  let idleTimer = 0;
  function wake() {
    frame.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (playing && isFull()) frame.classList.add('idle'); }, 3200);
  }
  frame.addEventListener('pointermove', wake);
  frame.addEventListener('pointerdown', wake);

  // A tap on the picture pauses and resumes (the cards have their own buttons).
  stage.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    if (at < 0) { begin(0); return; }
    if (at >= total) return;
    toggle();
  });
  const onKey = (e) => {
    if (!root.isConnected || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key === ' ' || e.code === 'Space') {
      if (t instanceof HTMLElement && t.tagName === 'BUTTON') return; // the focused button handles it
      e.preventDefault(); toggle();
    } else if (e.key === 'ArrowRight') { e.preventDefault(); jump(at - 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); jump(at + 1); } else if (e.key === 'f' || e.key === 'F' || e.key === 'כ') toggleFull();
    else return;
    wake();
  };
  document.addEventListener('keydown', onKey);

  // ---- start ----
  lesson?.classList.add('parasha-lesson');
  root.append(film);
  setSpeed(speed);
  setPlaying(false);
  showTitle();
  paintNav();
  if (total === 0) end();
  else { preload(0); warm(0); if (ready) setReady?.(true); }

  // Leaving the film stops the voice, the timers and the listeners.
  const watch = setInterval(() => {
    if (root.isConnected) return;
    alive = false;
    quiet();
    stopSpeech();
    try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch { /* never loaded */ }
    clearInterval(watch); clearInterval(ticker); clearTimeout(idleTimer);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('fullscreenchange', onFullChange);
    document.documentElement.classList.remove('pf-noscroll');
    lesson?.classList.remove('story-done', 'parasha-lesson');
  }, 1000);

  return { getAnswer: () => null, info: true, gated: true, ready: () => ready, nextLabel: 'לשאלות ←' };
}
