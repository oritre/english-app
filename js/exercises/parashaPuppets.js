import { el } from '../util.js';
import { spriteUrl } from '../media.js';
import { framePlan, stagePlan, parseAct, mouthStep, flapLevel, puppetGrade, envelope, seeded } from '../parashaLogic.js';

// The characters of the parasha film: cut-out figures that stand in the scene,
// breathe, blink, turn to whoever speaks, walk, and move their mouth with the
// sound of their own voice.
//
// A character is a few pictures of the same figure on the same canvas (base,
// talk, blink, gesture, gesture_talk), painted by the Pi (media.js spriteUrl)
// facing right. They are stacked and only one is visible at a time, so a change
// of frame is a change of opacity. Everything else is a transform, written from
// one requestAnimationFrame loop that runs only while the film plays.

const WALK = 0.4; // stage widths a second
const STEPS = 1.9; // steps a second while walking
const GROUND = 0.92; // where the feet stand, as a share of the stage height
const TURN_MS = 260;
const TAU = Math.PI * 2;
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2);

// The recording as loudness over time (parashaLogic envelope), or null when the
// browser can't decode it here.
export async function voiceTrack(buf) {
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx(1, 2, 22050);
  const audio = await new Promise((ok, bad) => {
    const p = ctx.decodeAudioData(buf, ok, bad);
    if (p?.then) p.then(ok, bad);
  });
  return envelope(audio.getChannelData(0), audio.sampleRate);
}

// Where the figure is inside its canvas (the frames keep the painted margins):
// left, top, right, bottom as shares of the picture. The whole canvas when the
// picture can't be read.
function figureBox(img) {
  const full = { l: 0, t: 0, r: 1, b: 1 };
  try {
    const h = 120;
    const w = Math.max(1, Math.round((img.naturalWidth / img.naturalHeight) * h));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let l = w; let r = -1; let t = h; let b = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 60) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
      }
    }
    if (r < l || b - t < h * 0.2) return full;
    return { l: l / w, t: t / h, r: (r + 1) / w, b: (b + 1) / h };
  } catch { return full; }
}

// An image that is loaded and decoded, ready to be shown without a hitch.
// First with CORS (so the figure can be measured), then plainly.
async function picture(url) {
  for (const cors of [true, false]) {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.alt = '';
    img.draggable = false;
    try {
      await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
      if (img.decode) await img.decode().catch(() => {});
      if (img.naturalWidth > 0) return img;
    } catch { /* try the other way */ }
  }
  return null;
}

export function createPuppets({ cast, scenes, stage, reduced = () => false }) {
  const plans = scenes.map((s) => stagePlan(s, cast));
  const used = [...new Set(plans.flatMap((p) => p.map((it) => it.who)))];
  const none = { any: false, build: () => null, show() {}, speak() {}, hush() {}, act: () => Promise.resolve(), setPlaying() {}, load() {}, destroy() {}, has: () => false };
  if (!used.length) return none;

  let alive = true;
  let playing = false;
  let raf = 0;
  let last = 0;
  let T = 0; // the puppets' own clock (ms): it stands still while the film is paused
  let W = stage.clientWidth || 640;
  let H = stage.clientHeight || 360;
  let sized = 0;
  let voice = null; // { who, gesture, level() }
  let pups = [];
  const live = new Map(); // scene index -> { layer, pups }
  const waiters = [];

  const onSize = () => { W = stage.clientWidth || W; H = stage.clientHeight || H; sized += 1; };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(onSize) : null;
  if (ro) ro.observe(stage); else addEventListener('resize', onSize);

  // ---- the pictures ----
  const store = Object.fromEntries(used.map((w) => [w, { frames: {}, box: null, ratio: 0 }]));
  const jobs = framePlan(cast, used).map((j) => ({ ...j, state: 'idle', tries: 0 }));
  let loading = false;
  let down = false; // the Pi did not answer: one try for each of the rest
  const load = async () => {
    if (loading || !alive) return;
    loading = true;
    for (const job of jobs) {
      if (!alive) break;
      if (job.state === 'ok' || job.tries >= 3) continue;
      const ch = store[job.who];
      const ref = job.ref ? ch.frames[job.ref] : null;
      if (job.ref && !ref) continue; // what it is edited from has not been painted
      const got = await spriteUrl(job.p, ref ? ref.hash : '').catch(() => null);
      if (!got) { down = true; break; } // no family code on this device
      let img = null;
      while (alive && !img && job.tries < (down ? 1 : 3)) {
        job.tries += 1;
        img = await picture(job.tries > 1 ? `${got.url}&n=${job.tries}` : got.url);
        if (!img && job.tries < 3 && !down) await new Promise((r) => setTimeout(r, 7000 * job.tries));
      }
      if (!img) { job.state = 'fail'; if (job.name === 'base') down = true; continue; }
      down = false;
      job.state = 'ok';
      if (job.name === 'base') { ch.box = figureBox(img); ch.ratio = img.naturalWidth / img.naturalHeight; }
      ch.frames[job.name] = { url: img.src, hash: got.hash };
      for (const sc of live.values()) for (const p of sc.pups) if (p.who === job.who) attach(p, job.name);
    }
    loading = false;
  };

  // Puts a frame that has arrived on a figure. The base comes first and sets the
  // place of all the others (they share its canvas).
  const attach = (p, name) => {
    const ch = store[p.who];
    const f = ch.frames[name];
    if (!f || p.imgs[name] || p.pending[name] || (name !== 'base' && !p.imgs.base && !p.pending.base)) return;
    p.pending[name] = true;
    const img = new Image();
    img.className = 'pf-pup-img';
    img.dataset.f = name;
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    img.src = f.url;
    const box = ch.box || { l: 0, t: 0, r: 1, b: 1 };
    const bh = Math.max(0.2, box.b - box.t);
    img.style.height = `${(100 / bh).toFixed(2)}%`;
    img.style.bottom = `${(-100 * (1 - box.b) / bh).toFixed(2)}%`;
    img.style.transform = `translate3d(${(-50 * (box.l + box.r)).toFixed(2)}%,0,0)`;
    img.style.opacity = '0';
    const put = () => {
      if (!alive) return;
      p.body.append(img);
      p.imgs[name] = img;
      if (name === 'base') {
        img.style.opacity = '1';
        p.frame = 'base';
        p.shadow.style.width = `calc(var(--h) * 100cqh * ${Math.max(0.24, Math.min(0.7, ((box.r - box.l) * ch.ratio / bh) * 0.95)).toFixed(3)})`;
        p.blinkAt = T + 1200 + p.rnd() * 3000;
        paintPup(p, 0, true);
        p.root.classList.add('on');
        p.layer.closest('.pf-scene')?.classList.add('has-pups');
        for (const n of Object.keys(ch.frames)) attach(p, n);
      }
    };
    (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(put);
  };

  // ---- a scene's figures ----
  const build = (i) => {
    const plan = plans[i];
    if (!plan?.length) return null;
    for (const [k, sc] of live) if (k !== i && !sc.layer.isConnected) live.delete(k);
    const layer = el('div', { class: `pf-pups pf-g-${puppetGrade(scenes[i])}`, 'aria-hidden': 'true' });
    const rnd = seeded(`${scenes[i].id || i}pups`);
    const made = plan.map((it, k) => {
      const h = Math.min(0.95, Math.max(0.2, (Number(cast[it.who].height) || 0.62) * it.scale));
      const shadow = el('div', { class: 'pf-pup-shadow' });
      const body = el('div', { class: 'pf-pup-body' });
      const flip = el('div', { class: 'pf-pup-flip' }, body);
      const root = el('div', { class: 'pf-pup', style: `--h:${h.toFixed(3)}; z-index:${Math.round(it.scale * 10) + k}` }, shadow, flip);
      layer.append(root);
      const from = it.enter === 'l' ? -0.16 : it.enter === 'r' ? 1.16 : it.x;
      const p = {
        who: it.who, h, layer, root, shadow, flip, body, imgs: {}, pending: {}, frame: '', rnd,
        x: from, target: it.enter ? it.x : null, home: it.face,
        face: it.enter ? (it.enter === 'l' ? 1 : -1) : it.face, want: it.enter ? (it.enter === 'l' ? 1 : -1) : it.face,
        turn: null, walkPh: rnd() * TAU, walkAmt: 0, entering: !!it.enter,
        mouth: { open: false, since: -1e9 }, lv: 0, nodAt: -1e9, popAt: -1e9, pose: false,
        blinkAt: Infinity, blinkUntil: 0,
        breathMs: 3500 + rnd() * 1000, swayMs: 6200 + rnd() * 2600, ph1: rnd() * TAU, ph2: rnd() * TAU,
        s: { root: '', flip: '', body: '', shadow: '', sized: -1 },
      };
      return p;
    });
    live.set(i, { layer, pups: made });
    for (const p of made) attach(p, 'base');
    return layer;
  };

  const show = (i) => {
    pups = live.get(i)?.pups || [];
    voice = null;
    waiters.length = 0;
    if (jobs.some((j) => j.state === 'fail')) { for (const j of jobs) if (j.state === 'fail') { j.state = 'idle'; j.tries = Math.min(j.tries, 2); } }
    load();
    for (const p of pups) paintPup(p, 0, true);
    run();
  };

  const setFrame = (p, name) => {
    if (name === p.frame || !p.imgs[name]) return;
    p.imgs[name].style.opacity = '1';
    if (p.imgs[p.frame]) p.imgs[p.frame].style.opacity = '0';
    p.frame = name;
  };

  // One figure, one frame of time: where it is, which picture shows, how it leans.
  const paintPup = (p, dt, force = false) => {
    if (!p.imgs.base) return;
    const still = reduced();
    const hpx = p.h * H;

    // walking
    let walking = false;
    if (p.target != null) {
      const d = p.target - p.x;
      const step = (WALK * dt) / 1000;
      if (Math.abs(d) <= step || Math.abs(d) < 0.002) {
        p.x = p.target; p.target = null;
        if (p.entering) { p.entering = false; p.want = p.home; }
      } else {
        walking = true;
        p.x += Math.sign(d) * step;
        p.want = Math.sign(d);
        p.walkPh += (dt / 1000) * TAU * STEPS * 0.5;
      }
    }
    p.walkAmt += ((walking && !still ? 1 : 0) - p.walkAmt) * Math.min(1, dt / 140);

    // turning: a quick fold through the middle, with a small squash
    let fx = p.face;
    let fy = 1;
    if (!p.turn && p.want !== p.face) p.turn = { from: p.face, to: p.want, k: 0 };
    if (p.turn) {
      p.turn.k += still ? 1 : dt / TURN_MS;
      const k = ease(Math.min(1, p.turn.k));
      fx = p.turn.from + (p.turn.to - p.turn.from) * k;
      if (Math.abs(fx) < 0.06) fx = fx < 0 ? -0.06 : 0.06;
      fy = 1 - 0.045 * Math.sin(Math.PI * k);
      if (p.turn.k >= 1) { p.face = p.turn.to; fx = p.face; fy = 1; p.turn = null; }
    }

    // the voice: the mouth, and how much the body moves with it
    const speaking = !!voice && voice.who === p.who;
    let level = 0;
    if (speaking) {
      const v = voice.level();
      level = v == null ? flapLevel(T) : v;
      p.mouth = mouthStep(p.mouth, level, T);
      if (level > 0.8 && p.lv < 0.6 && T - p.nodAt > 480) p.nodAt = T; // a stressed word: a nod
    } else if (p.mouth.open) p.mouth = { open: false, since: T };
    p.lv += (level - p.lv) * Math.min(1, dt / 110);

    // blinking: between words, never in a pose that has no closed-eyes picture
    const pose = speaking && voice.gesture && !!p.imgs.gesture;
    if (T >= p.blinkAt) {
      if (p.mouth.open || pose) p.blinkAt = T + 160;
      else { if (p.imgs.blink) p.blinkUntil = T + 120; p.blinkAt = T + 2500 + p.rnd() * 3500; }
    }
    if (pose !== p.pose) { p.pose = pose; p.popAt = T; }
    setFrame(p, pose ? (p.mouth.open && p.imgs.gesture_talk ? 'gesture_talk' : 'gesture')
      : T < p.blinkUntil && p.imgs.blink ? 'blink'
        : p.mouth.open && p.imgs.talk ? 'talk' : 'base');

    // the body: breath, a slow shift of weight, the walk, the voice
    const breath = still ? 0 : 0.5 + 0.5 * Math.sin((T / p.breathMs) * TAU + p.ph1);
    const sway = still ? 0 : Math.sin((T / p.swayMs) * TAU + p.ph2);
    const nod = Math.sin(Math.PI * Math.max(0, 1 - (T - p.nodAt) / 380));
    const pop = still ? 0 : Math.sin(Math.PI * Math.max(0, 1 - (T - p.popAt) / 260));
    const talk = p.lv * (p.imgs.talk ? 1 : 2.4); // with no talking picture the body says it
    const lift = Math.abs(Math.sin(p.walkPh)) * p.walkAmt;
    const y = -lift * 0.02 * hpx - talk * 0.005 * hpx - pop * 0.014 * hpx + nod * 0.004 * hpx;
    const rot = sway * 0.45 + (Math.sin(p.walkPh * 2 + 0.6) * 1.5 + 1.3) * p.walkAmt + nod * 1.5 + talk * 0.45;
    const sx = 1 - breath * 0.004 - pop * 0.012 + sway * 0.002;
    const sy = 1 + breath * 0.012 + pop * 0.028;

    const s = p.s;
    const tr = `translate3d(${(p.x * W).toFixed(1)}px,${(GROUND * H).toFixed(1)}px,0)`;
    if (force || tr !== s.root) { p.root.style.transform = tr; s.root = tr; }
    const tf = `scale(${fx.toFixed(3)},${fy.toFixed(3)})`;
    if (force || tf !== s.flip) { p.flip.style.transform = tf; s.flip = tf; }
    const tb = `translate3d(0,${y.toFixed(2)}px,0) rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
    if (force || tb !== s.body) { p.body.style.transform = tb; s.body = tb; }
    const ts = `translate3d(-50%,-50%,0) scale(${(1 - lift * 0.22 - pop * 0.08).toFixed(3)})`;
    if (force || ts !== s.shadow) { p.shadow.style.transform = ts; s.shadow = ts; }
  };

  const settled = (p) => !p.imgs.base || (p.target == null && !p.turn && p.want === p.face);
  const frame = (ts) => {
    raf = 0;
    if (!alive || !playing || !pups.length) return;
    const dt = Math.min(50, Math.max(0, ts - (last || ts)));
    last = ts;
    T += dt;
    for (const p of pups) paintPup(p, dt, p.s.sized !== sized);
    for (const p of pups) p.s.sized = sized;
    for (let k = waiters.length - 1; k >= 0; k--) if (settled(waiters[k].p)) waiters.splice(k, 1)[0].done();
    raf = requestAnimationFrame(frame);
  };
  const run = () => { if (!raf && alive && playing && pups.length) { last = 0; raf = requestAnimationFrame(frame); } };

  const find = (who) => pups.find((p) => p.who === who && p.imgs.base);

  return {
    any: true,
    build,
    show,
    load,
    has: (who) => !!find(who),
    // Who speaks now. The others turn to face the speaker.
    speak(who, gesture, level) {
      voice = { who, gesture: !!gesture, level };
      const sp = find(who);
      if (!sp) return;
      for (const p of pups) {
        if (p === sp || !p.imgs.base || p.target != null) continue;
        const to = Math.sign(sp.x - p.x);
        if (to) p.want = to;
      }
    },
    hush() { voice = null; },
    // What the character does before the line: resolves when the walk and the turn are over.
    act(who, act, fresh = true) {
      const p = find(who);
      const a = parseAct(act);
      if (!p) return Promise.resolve();
      if (a.turn && fresh && p.target == null) p.want = -p.want;
      if (a.walk != null && Math.abs(a.walk - p.x) > 0.01) { p.target = a.walk; p.entering = false; }
      if (settled(p)) return Promise.resolve();
      return new Promise((done) => { waiters.push({ p, done }); });
    },
    setPlaying(on) { playing = !!on; if (playing) run(); },
    destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect(); else removeEventListener('resize', onSize);
      live.clear();
      pups = [];
    },
  };
}
