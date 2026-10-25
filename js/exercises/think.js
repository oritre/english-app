import { el, mixed, shuffle } from '../util.js';
import { speakSequence, canSpeakLang } from '../speech.js';
import { parseNum, sameNumber, runRobot, MOVES } from '../thinkLogic.js';

// The "think" track (math and logic, after Brilliant): you learn by doing.
// Every problem has something to move, tap or build, a hint you can open, and
// an explanation after the answer. These exercises check themselves (check()),
// so the lesson runner doesn't run them through the English answer checker.
export const THINK_TYPES = new Set(['mcq', 'number', 'balance', 'fraction', 'numberline', 'order', 'robot', 'buckets', 'angle', 'sim']);

// Hebrew text goes through mixed(); a formula or a number ("2x + 1 = 7") keeps left-to-right order.
export const txt = (s) => (/[\u0590-\u05FF]/.test(String(s)) ? mixed(s) : [el('span', { dir: 'ltr', class: 'formula' }, String(s))]);

// DOM append would print null as text; the optional parts are left out instead.
const put = (root, ...nodes) => root.append(...nodes.flat().filter((x) => x != null && x !== false));

const sayHe = (text) => { if (text && canSpeakLang('he-IL')) speakSequence([{ text, lang: 'he-IL' }]); };

// ---- scale ----

const weightOf = (side) => side.reduce((s, it) => s + (it.w ?? 0) * it.n, 0);

// Draws a two-pan scale. The tilt is computed from known weights, or given
// (tilt: 'left' | 'right' | 'even') when a weight is the mystery.
export function scaleView({ left, right, tilt }) {
  const items = (side) => el('div', { class: 'pan-items' }, side.flatMap((it) => Array.from({ length: it.n }, () =>
    el('span', { class: 'pan-item' }, it.icon, it.label != null ? el('small', {}, it.label) : null))));
  const beam = el('div', { class: 'beam' });
  const leftPan = el('div', { class: 'pan' }, items(left));
  const rightPan = el('div', { class: 'pan' }, items(right));
  const arm = el('div', { class: 'scale-arm' }, el('div', { class: 'pan-hang' }, leftPan), beam, el('div', { class: 'pan-hang' }, rightPan));
  const view = el('div', { class: 'scale', dir: 'ltr' }, arm, el('div', { class: 'scale-post' }), el('div', { class: 'scale-base' }));
  const update = (l = left, r = right, t = tilt) => {
    const diff = t === 'left' ? -1 : t === 'right' ? 1 : t === 'even' ? 0 : weightOf(r) - weightOf(l);
    const deg = diff === 0 ? 0 : Math.sign(diff) * Math.min(14, 5 + Math.abs(diff) * 2);
    arm.style.setProperty('--tilt', `${deg}deg`);
    view.classList.toggle('even', diff === 0);
    leftPan.replaceChildren(items(l));
    rightPan.replaceChildren(items(r));
  };
  update();
  return { view, update };
}

// ---- shared parts ----

// Title (read aloud in Hebrew on tap), an optional picture, and a hint behind a button.
function header(root, ex, track) {
  const read = () => sayHe([ex.prompt_he, ex.say_he].filter(Boolean).join('. '));
  const hint = ex.hint_he ? el('p', { class: 'think-hint', hidden: true }, '💡 ', ...mixed(ex.hint_he)) : null;
  const hintBtn = ex.hint_he ? el('button', {
    class: 'hint-btn', type: 'button',
    onclick: () => { hint.hidden = false; hintBtn.hidden = true; track?.('hint', ''); sayHe(ex.hint_he); },
  }, '💡 רמז') : null;
  put(root, 
    el('h2', { class: 'ex-title think-title' }, ...mixed(ex.prompt_he),
      canSpeakLang('he-IL') ? el('button', { class: 'speaker small', type: 'button', 'aria-label': 'הקראה', onclick: read }, '🔊') : null),
    ...(ex.body_he || []).map((p) => el('p', { class: 'teach-body' }, ...mixed(p))),
    ex.visual ? el('div', { class: 'think-visual', dir: 'ltr' }, ex.visual.split('\n').map((line) => el('div', {}, line))) : null,
    ex.scale ? scaleView(ex.scale).view : null,
    ex.bars ? barsView(ex.bars) : null);
  return { hint, hintBtn };
}

// Fraction bars side by side, for comparing: [{parts, shaded, label}].
function barsView(bars) {
  return el('div', { class: 'bars-compare', dir: 'ltr' }, bars.map((b) => el('div', { class: 'bar-row' },
    el('div', { class: 'frac-bar static' }, Array.from({ length: b.parts }, (_, i) => el('span', { class: `frac-cell ${i < b.shaded ? 'on' : ''}` }))),
    b.label ? el('span', { class: 'bar-label' }, b.label) : null)));
}

const footer = (root, { hint, hintBtn }) => { if (hintBtn) put(root, el('div', { class: 'hint-row' }, hintBtn, hint)); };

// ---- exercise types ----

// Pick one answer. Options are text or {label, show} (a picture or a big symbol).
export function renderMcq(root, ex, { setReady, track }) {
  const h = header(root, ex, track);
  let picked = null;
  const opts = ex.options.map((o) => (typeof o === 'object' ? o : { label: String(o) }));
  const big = opts.some((o) => o.show);
  const cards = (ex.keep_order ? opts : shuffle(opts)).map((o) => {
    const card = el('button', { class: `choice-card think-choice ${big ? 'big' : ''}`, type: 'button', 'data-value': o.label },
      o.show ? el('span', { class: 'think-show', dir: 'ltr' }, o.show) : null,
      el('span', {}, ...txt(o.label)));
    card.addEventListener('click', () => {
      cards.forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      picked = o.label;
      setReady(true);
    });
    return card;
  });
  put(root, el('div', { class: `choice-grid ${opts.length > 4 || opts.some((o) => o.label.length > 18) ? 'one-col' : ''}` }, cards));
  footer(root, h);
  return { getAnswer: () => picked, check: () => picked === String(ex.answer), expectedText: () => String(ex.answer) };
}

// Type a number (or a fraction) on an on-screen keypad, so phones never open a keyboard.
export function renderNumber(root, ex, { setReady, track }) {
  const h = header(root, ex, track);
  let value = '';
  const shown = el('span', { class: 'num-value' });
  const show = () => { shown.textContent = value || '?'; shown.classList.toggle('empty', !value); setReady(parseNum(value) != null); };
  const press = (k) => {
    if (k === '⌫') value = value.slice(0, -1);
    else if (value.length < 8) {
      if (k === '/' && (value.includes('/') || !value)) return;
      if (k === '-' && value) return;
      value += k;
    }
    track?.('key', k);
    show();
  };
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', ex.fraction ? '/' : ex.negative ? '-' : '', '0', '⌫'];
  put(root, 
    el('div', { class: 'num-display', dir: 'ltr' }, ex.before ? el('span', {}, ex.before) : null, shown, ex.after ? el('span', {}, ex.after) : null),
    el('div', { class: 'keypad', dir: 'ltr' }, keys.map((k) => (k ? el('button', { class: 'key', type: 'button', onclick: () => press(k) }, k) : el('span')))));
  footer(root, h);
  show();
  return { getAnswer: () => value, check: () => sameNumber(value, ex.answer, { exact: ex.exact }), expectedText: () => String(ex.answer) };
}

// A scale with one thing you can add or take away until both sides weigh the same.
// ex.left / ex.right: [{icon, w, n, adjustable?}]; the answer is the adjustable count.
export function renderBalance(root, ex, { setReady, track }) {
  const h = header(root, ex, track);
  const left = ex.left.map((it) => ({ ...it }));
  const right = ex.right.map((it) => ({ ...it }));
  const adj = [...left, ...right].find((it) => it.adjustable);
  const scale = scaleView({ left, right });
  const count = el('span', { class: 'bal-count' });
  const status = el('p', { class: 'bal-status' });
  const refresh = () => {
    scale.update(left, right);
    count.textContent = adj ? adj.n : '';
    const diff = weightOf(right) - weightOf(left);
    status.textContent = diff === 0 ? '⚖️ מאוזן!' : (diff > 0 ? 'הצד הימני כבד יותר' : 'הצד השמאלי כבד יותר');
    status.className = `bal-status ${diff === 0 ? 'good' : ''}`;
  };
  const step = (d) => { adj.n = Math.max(0, Math.min(ex.max ?? 20, adj.n + d)); track?.('adjust', adj.n); refresh(); setReady(true); };
  put(root, scale.view, status,
    adj ? el('div', { class: 'bal-controls' },
      el('button', { class: 'key', type: 'button', 'aria-label': 'להוריד', onclick: () => step(-1) }, '−'),
      el('span', { class: 'bal-adj' }, adj.icon, ' × ', count),
      el('button', { class: 'key', type: 'button', 'aria-label': 'להוסיף', onclick: () => step(1) }, '+')) : null);
  footer(root, h);
  refresh();
  if (ex.explore) return { getAnswer: () => null, info: true };
  return { getAnswer: () => adj.n, check: () => adj.n === Number(ex.answer), expectedText: () => `${ex.answer} ${adj.icon}` };
}

// Tap parts of a bar or a pizza to colour them. The answer is how many parts
// are coloured, or a fraction the coloured part must equal (answer: "3/4").
export function renderFraction(root, ex, { setReady, track }) {
  const h = header(root, ex, track);
  const n = ex.parts;
  const on = new Set(Array.from({ length: ex.shaded || 0 }, (_, i) => i));
  const label = el('div', { class: 'frac-label', dir: 'ltr' });
  let cells;
  const toggle = (i) => {
    if (ex.locked) return;
    on.has(i) ? on.delete(i) : on.add(i);
    track?.('cell', on.size);
    paint();
    setReady(true);
  };
  if (ex.shape === 'circle') {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-1.05 -1.05 2.1 2.1');
    svg.setAttribute('class', 'frac-pie');
    cells = Array.from({ length: n }, (_, i) => {
      const a0 = (i / n) * 2 * Math.PI - Math.PI / 2;
      const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
      const p = document.createElementNS(NS, n === 1 ? 'circle' : 'path');
      if (n === 1) { p.setAttribute('r', '1'); } else {
        p.setAttribute('d', `M0 0 L${Math.cos(a0)} ${Math.sin(a0)} A1 1 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${Math.cos(a1)} ${Math.sin(a1)} Z`);
      }
      p.setAttribute('class', 'frac-slice');
      p.addEventListener('click', () => toggle(i));
      svg.append(p);
      return p;
    });
    put(root, el('div', { class: 'frac-wrap' }, svg, label));
  } else {
    cells = Array.from({ length: n }, (_, i) => el('button', { class: 'frac-cell', type: 'button', 'aria-label': `חלק ${i + 1}`, onclick: () => toggle(i) }));
    put(root, el('div', { class: 'frac-wrap' }, el('div', { class: 'frac-bar', dir: 'ltr' }, cells), label));
  }
  function paint() {
    cells.forEach((c, i) => c.classList.toggle('on', on.has(i)));
    label.textContent = ex.hide_label ? '' : `${on.size}/${n}`;
  }
  footer(root, h);
  paint();
  if (ex.explore) return { getAnswer: () => null, info: true };
  const right = () => (String(ex.answer).includes('/') ? sameNumber(`${on.size}/${n}`, ex.answer) : on.size === Number(ex.answer));
  return { getAnswer: () => `${on.size}/${n}`, check: right, expectedText: () => (String(ex.answer).includes('/') ? ex.answer : `${ex.answer}/${n}`) };
}

// Drag a marker along a number line. Right when it lands within half a step.
export function renderNumberLine(root, ex, { setReady, track }) {
  const h = header(root, ex, track);
  const { min, max } = ex;
  const step = parseNum(ex.step ?? 1);
  const slider = el('input', { type: 'range', class: 'nl-range', min, max, step, value: ex.start ?? min, 'aria-label': 'המיקום על הציר' });
  const readout = el('div', { class: 'nl-readout', dir: 'ltr' });
  const fmt = (v) => {
    if (ex.denominator) return `${Math.round(v * ex.denominator)}/${ex.denominator}`;
    return String(Math.round(v * 1000) / 1000);
  };
  const ticks = el('div', { class: 'nl-ticks' }, (ex.labels || [min, max]).map((t) => {
    const at = parseNum(typeof t === 'object' ? t.at : t);
    return el('span', { class: 'nl-tick', style: `left: ${((at - min) / (max - min)) * 100}%` }, typeof t === 'object' ? t.text : String(t));
  }));
  const update = () => { readout.textContent = ex.show_value === false ? '' : fmt(Number(slider.value)); };
  slider.addEventListener('input', () => { update(); setReady(true); });
  slider.addEventListener('change', () => track?.('slide', slider.value));
  put(root, el('div', { class: 'nl', dir: 'ltr' }, readout, slider, ticks));
  footer(root, h);
  update();
  const target = parseNum(ex.answer);
  return { getAnswer: () => fmt(Number(slider.value)), check: () => Math.abs(Number(slider.value) - target) <= step / 2 + 1e-9, expectedText: () => String(ex.answer) };
}

// Put things in order: tap them into the row, tap a placed one to take it back.
export function renderOrder(root, ex, { setReady, track }) {
  const h = header(root, ex, track);
  const placed = [];
  const line = el('div', { class: 'answer-line order-line', dir: ex.rtl ? 'rtl' : 'ltr' });
  const pool = el('div', { class: 'word-bank', dir: ex.rtl ? 'rtl' : 'ltr' });
  const tiles = shuffle(ex.items.map((t, i) => ({ t: String(t), i })));
  const draw = () => {
    line.replaceChildren(...placed.map((p, k) => el('button', { class: 'tile', type: 'button', onclick: () => { placed.splice(k, 1); draw(); } }, p.t)));
    pool.replaceChildren(...tiles.map((p) => el('button', {
      class: `tile ${placed.includes(p) ? 'matched' : ''}`, type: 'button', disabled: placed.includes(p),
      onclick: () => { placed.push(p); track?.('tile', p.t); draw(); },
    }, p.t)));
    setReady(placed.length === tiles.length);
  };
  put(root, ex.ends ? el('div', { class: 'order-ends', dir: ex.rtl ? 'rtl' : 'ltr' }, el('span', {}, ex.ends[0]), el('span', {}, ex.ends[1])) : null, line, pool);
  footer(root, h);
  draw();
  const answer = (ex.answer || ex.items).map(String);
  return { getAnswer: () => placed.map((p) => p.t).join(' · '), check: () => placed.map((p) => p.t).join('|') === answer.join('|'), expectedText: () => answer.join(' · ') };
}

// ---- code: a robot on a grid ----

export function renderRobot(root, ex, { setReady, track }) {
  const h = header(root, ex, track);
  const grid = ex.grid;
  const program = [];
  const cells = [];
  const board = el('div', { class: 'robot-grid', dir: 'ltr', style: `grid-template-columns: repeat(${grid[0].length}, 1fr)` },
    grid.flatMap((row, j) => [...row].map((c, i) => {
      const cell = el('div', { class: `robot-cell ${c === '#' ? 'wall' : ''}` }, c === '*' ? '⭐' : c === '#' ? '🧱' : '');
      cells.push({ cell, i, j });
      return cell;
    })));
  const bot = el('div', { class: 'robot-bot' }, ex.bot || '🤖');
  board.append(bot);
  const start = (() => { for (let j = 0; j < grid.length; j++) { const i = grid[j].indexOf('R'); if (i >= 0) return { x: i, y: j }; } return { x: 0, y: 0 }; })();
  const place = ({ x, y }) => { bot.style.setProperty('--x', x); bot.style.setProperty('--y', y); };
  bot.style.setProperty('--cols', grid[0].length);
  bot.style.setProperty('--rows', grid.length);
  place(start);
  const line = el('div', { class: 'answer-line program-line', dir: 'ltr' });
  const tools = (ex.commands || ['up', 'down', 'left', 'right']);
  const label = (t) => (MOVES[t] ? MOVES[t][2] : t.replace('x', '🔁×'));
  let timer = null;
  const animate = (steps) => {
    clearInterval(timer);
    place(start);
    bot.classList.remove('crash', 'win');
    let k = 0;
    timer = setInterval(() => {
      if (k >= steps.length) { clearInterval(timer); return; }
      const st = steps[k++];
      place(st);
      if (st.crash) bot.classList.add('crash');
      else if (k === steps.length && runRobot(grid, program).ok) bot.classList.add('win');
    }, 380);
  };
  const draw = () => {
    line.replaceChildren(...(program.length ? program.map((t, k) => el('button', { class: 'tile cmd', type: 'button', onclick: () => { program.splice(k, 1); draw(); } }, label(t)))
      : [el('span', { class: 'muted program-empty' }, 'לחצו על הפקודות כדי לבנות תוכנית')]));
    setReady(program.length > 0);
  };
  const full = () => ex.max && program.length >= ex.max;
  put(root, board,
    el('div', { class: 'program-head' }, el('span', {}, '📜 התוכנית', ex.max ? ` (עד ${ex.max} פקודות)` : ''),
      el('button', { class: 'btn small', type: 'button', onclick: () => { track?.('run', program.join(',')); animate(runRobot(grid, program).steps); } }, '▶ הרצה')),
    line,
    el('div', { class: 'word-bank cmd-bank', dir: 'ltr' }, tools.map((t) => el('button', {
      class: 'tile cmd', type: 'button',
      onclick: () => { if (full()) return; program.push(t); track?.('cmd', t); draw(); },
    }, label(t)))));
  footer(root, h);
  draw();
  return {
    getAnswer: () => program.join(','),
    check: () => { const r = runRobot(grid, program); animate(r.steps); return r.ok; },
    expectedText: () => (ex.solution || []).map(label).join(' '),
  };
}

// ---- sort things into groups ----

export function renderBuckets(root, ex, { setReady, track }) {
  const h = header(root, ex, track);
  const where = new Map();
  let picked = null;
  const items = shuffle(ex.items.map((it, i) => ({ ...it, i })));
  const pool = el('div', { class: 'word-bank bucket-pool' });
  const boxes = ex.buckets.map((b) => ({ b, zone: el('div', { class: 'bucket-items' }) }));
  const tile = (it) => el('button', {
    class: `tile bucket-tile ${picked === it ? 'selected' : ''}`, type: 'button',
    onclick: () => {
      if (where.has(it.i)) { where.delete(it.i); picked = null; } else picked = picked === it ? null : it;
      draw();
    },
  }, it.label);
  const draw = () => {
    pool.replaceChildren(...items.filter((it) => !where.has(it.i)).map(tile));
    boxes.forEach(({ b, zone }) => zone.replaceChildren(...items.filter((it) => where.get(it.i) === b.id).map(tile)));
    root.querySelectorAll('.bucket').forEach((z) => z.classList.toggle('armed', !!picked));
    setReady(where.size === items.length);
  };
  put(root, pool, el('div', { class: 'buckets' }, boxes.map(({ b, zone }) => el('button', {
    class: 'bucket', type: 'button',
    onclick: (e) => { if (!picked || e.target.closest('.bucket-tile')) return; where.set(picked.i, b.id); track?.('sort', `${picked.label}>${b.id}`); picked = null; draw(); },
  }, el('span', { class: 'bucket-name' }, ...mixed(b.label)), zone))));
  footer(root, h);
  draw();
  const name = (id) => ex.buckets.find((b) => b.id === id)?.label || id;
  return {
    getAnswer: () => items.map((it) => `${it.label}>${where.get(it.i)}`).join(', '),
    check: () => items.every((it) => where.get(it.i) === it.in),
    expectedText: () => ex.buckets.map((b) => `${b.label}: ${ex.items.filter((it) => it.in === b.id).map((it) => it.label).join(' ')}`).join(' · '),
  };
}

// ---- angles ----

export function renderAngle(root, ex, { setReady, track }) {
  const h = header(root, ex, track);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-110 -110 220 120');
  svg.setAttribute('class', 'angle-svg');
  const mk = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); svg.append(n); return n; };
  for (let d = 0; d <= 180; d += 30) {
    const r = (d * Math.PI) / 180;
    mk('line', { x1: 92 * Math.cos(r), y1: -92 * Math.sin(r), x2: 100 * Math.cos(r), y2: -100 * Math.sin(r), class: 'angle-tick' });
  }
  const arc = mk('path', { class: 'angle-arc' });
  mk('line', { x1: 0, y1: 0, x2: 100, y2: 0, class: 'angle-ray' });
  const ray = mk('line', { x1: 0, y1: 0, x2: 100, y2: 0, class: 'angle-ray moving' });
  mk('circle', { cx: 0, cy: 0, r: 4, class: 'angle-dot' });
  const slider = el('input', { type: 'range', class: 'nl-range', min: 0, max: 180, step: 1, value: ex.start ?? 20, 'aria-label': 'גודל הזווית' });
  const readout = el('div', { class: 'nl-readout', dir: 'ltr' });
  const update = () => {
    const d = Number(slider.value);
    const r = (d * Math.PI) / 180;
    ray.setAttribute('x2', 100 * Math.cos(r));
    ray.setAttribute('y2', -100 * Math.sin(r));
    arc.setAttribute('d', `M30 0 A30 30 0 0 0 ${30 * Math.cos(r)} ${-30 * Math.sin(r)}`);
    readout.textContent = ex.show_value === false ? '' : `${d}°`;
  };
  slider.addEventListener('input', () => { update(); setReady(true); });
  slider.addEventListener('change', () => track?.('slide', slider.value));
  put(root, el('div', { class: 'angle-wrap', dir: 'ltr' }, svg, readout, slider));
  footer(root, h);
  update();
  const tol = ex.tolerance ?? 5;
  return { getAnswer: () => `${slider.value}°`, check: () => Math.abs(Number(slider.value) - Number(ex.answer)) <= tol, expectedText: () => `${ex.answer}°` };
}

// ---- chance: roll and watch the results pile up (explore only) ----

export function renderSim(root, ex, { track }) {
  const h = header(root, ex, track);
  const faces = ex.kind === 'coin' ? ['עץ', 'פלי'] : ex.kind === 'dice2' ? Array.from({ length: 11 }, (_, i) => String(i + 2)) : ['1', '2', '3', '4', '5', '6'];
  const counts = new Map(faces.map((f) => [f, 0]));
  let total = 0;
  const roll = () => {
    if (ex.kind === 'coin') return Math.random() < 0.5 ? 'עץ' : 'פלי';
    const d = () => 1 + Math.floor(Math.random() * 6);
    return String(ex.kind === 'dice2' ? d() + d() : d());
  };
  const last = el('div', { class: 'sim-last' }, ex.kind === 'coin' ? '🪙' : '🎲');
  const chart = el('div', { class: 'sim-chart', dir: 'ltr' });
  const draw = () => {
    const max = Math.max(1, ...counts.values());
    chart.replaceChildren(...faces.map((f) => el('div', { class: 'sim-col' },
      el('span', { class: 'sim-pct' }, total ? `${Math.round((counts.get(f) / total) * 100)}%` : ''),
      el('div', { class: 'sim-bar', style: `height: ${(counts.get(f) / max) * 100}%` }),
      el('span', { class: 'sim-face' }, f))));
  };
  const go = (n) => {
    let r;
    for (let k = 0; k < n; k++) { r = roll(); counts.set(r, counts.get(r) + 1); total++; }
    last.textContent = r;
    last.classList.remove('pop'); void last.offsetWidth; last.classList.add('pop');
    track?.('roll', n);
    draw();
    note.textContent = `${total} הטלות`;
  };
  const note = el('p', { class: 'muted sim-note' }, 'עוד לא הטלנו');
  put(root, el('div', { class: 'sim' }, last, chart, note,
    el('div', { class: 'row-btns sim-btns' }, [1, 10, 100].map((n) => el('button', { class: 'btn', type: 'button', onclick: () => go(n) }, n === 1 ? 'הטלה אחת' : `${n} הטלות`)))));
  footer(root, h);
  draw();
  return { getAnswer: () => null, info: true };
}
