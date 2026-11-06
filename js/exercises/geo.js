import { el, mixed } from '../util.js';

// Geometry for the think track (grade 8: angles, triangles, Pythagoras, the
// coordinate plane). A small figure language draws any exercise's picture as
// SVG, so lessons carry diagrams without image files, and four interactions:
// a Pythagoras explorer with live squares on the sides, a tap-a-point grid,
// tap-the-angle on crossing and parallel lines, and a timed quick-fire game.
export const GEO_TYPES = new Set(['pyth', 'plot', 'angles', 'blitz']);

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return n;
};
const fmt = (v) => String(Math.round(v * 100) / 100);
const PALETTE = ['#2563eb', '#db2777', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2'];
const color = (c) => (c == null ? 'var(--course, var(--ink))' : /^\d$/.test(String(c)) ? PALETTE[Number(c)] : c);

// ---- figure language ----
//
// fig: { pts: {A: [x, y], ...} (maths axes: y up), segs: [[P, Q, {label, dash, color, ticks}]],
//        poly: [{of: [P, Q, R], color, fill}], lines: [[P, Q]] (through both points),
//        angles: [{at, from, to, label, right, color}], circles: [{at, r, label, color, radius}],
//        names: true (label the points), texts: [{at: [x, y], text}], par: [[P, Q], [R, S]] (parallel marks),
//        grid: true (unit grid with axes), w: aspect hint }
export function figView(fig, { small = false } = {}) {
  const pts = fig.pts || {};
  const P = (name) => (Array.isArray(name) ? name : pts[name]) || [0, 0];
  const all = [...Object.values(pts), ...(fig.texts || []).map((t) => t.at)];
  for (const c of fig.circles || []) { const [x, y] = P(c.at); all.push([x - c.r, y - c.r], [x + c.r, y + c.r]); }
  if (fig.grid) { const g = fig.grid === true ? 5 : fig.grid; all.push([-g, -g], [g, g]); }
  if (!all.length) all.push([0, 0], [4, 3]);
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  let minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const range = Math.max(maxX - minX, maxY - minY, 1);
  const pad = range * (fig.names || fig.angles?.some((a) => a.label) ? 0.22 : 0.14);
  minX -= pad; maxX += pad; minY -= pad; maxY += pad;
  const svg = svgEl('svg', { class: `fig ${small ? 'small' : ''}`, viewBox: `${minX} ${-maxY} ${maxX - minX} ${maxY - minY}`, role: 'img', 'aria-label': fig.alt || 'איור' });
  const fs = range * (small ? 0.12 : 0.085);
  const sw = range * 0.012;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const text = (x, y, s, attrs = {}) => svg.append(svgEl('text', { x, y: -y, 'font-size': fs, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'fig-text', ...attrs }, s));
  const line = (a, b, attrs = {}) => svg.append(svgEl('line', { x1: a[0], y1: -a[1], x2: b[0], y2: -b[1], 'stroke-width': sw * 1.3, class: 'fig-line', ...attrs }));
  const toward = (a, b, d) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + ((b[0] - a[0]) / L) * d, a[1] + ((b[1] - a[1]) / L) * d]; };

  if (fig.grid) {
    const g = fig.grid === true ? 5 : fig.grid;
    for (let i = -g; i <= g; i++) {
      line([i, -g], [i, g], { class: `fig-grid ${i === 0 ? 'axis' : ''}`, 'stroke-width': i === 0 ? sw * 1.2 : sw * 0.5 });
      line([-g, i], [g, i], { class: `fig-grid ${i === 0 ? 'axis' : ''}`, 'stroke-width': i === 0 ? sw * 1.2 : sw * 0.5 });
      if (i && Math.abs(i) % (g > 4 ? 2 : 1) === 0) { text(i, -0.5, i, { class: 'fig-text axis', 'font-size': fs * 0.7 }); text(-0.55, i, i, { class: 'fig-text axis', 'font-size': fs * 0.7 }); }
    }
    text(g + 0.4, -0.5, 'x', { class: 'fig-text axis' }); text(-0.55, g + 0.4, 'y', { class: 'fig-text axis' });
    // Lines on a grid stay inside it.
    svg.append(svgEl('defs', {}, svgEl('clipPath', { id: 'fig-grid-clip' }, svgEl('rect', { x: -g, y: -g, width: 2 * g, height: 2 * g }))));
  }
  for (const poly of fig.poly || []) {
    const ps = poly.of.map(P);
    svg.append(svgEl('polygon', { points: ps.map((p) => `${p[0]},${-p[1]}`).join(' '), fill: color(poly.color), 'fill-opacity': poly.fill ?? 0.18, stroke: color(poly.color), 'stroke-width': sw * 1.3, 'stroke-linejoin': 'round' }));
  }
  for (const c of fig.circles || []) {
    const [x, y] = P(c.at);
    svg.append(svgEl('circle', { cx: x, cy: -y, r: c.r, fill: color(c.color), 'fill-opacity': 0.1, stroke: color(c.color), 'stroke-width': sw * 1.3 }));
    if (c.radius) { line([x, y], [x + c.r, y], { stroke: color(c.color), 'stroke-dasharray': `${sw * 3} ${sw * 3}` }); text(x + c.r / 2, y + fs * 0.7, c.radius); }
    if (c.label) text(x, y - fs * 0.9, c.label);
  }
  for (const [a, b] of fig.lines || []) {
    const A = P(a), B = P(b);
    line(toward(A, B, -range * 2), toward(B, A, -range * 2), { class: 'fig-line thin', 'stroke-width': sw, 'clip-path': fig.grid ? 'url(#fig-grid-clip)' : null });
  }
  for (const [a, b, o = {}] of fig.segs || []) {
    const A = P(a), B = P(b);
    line(A, B, { stroke: o.color != null ? color(o.color) : null, 'stroke-dasharray': o.dash ? `${sw * 4} ${sw * 4}` : null, 'stroke-width': sw * (o.bold ? 2.2 : 1.3) });
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L; // left-hand normal
    if (o.label != null) {
      // Without a side, the label goes outside the figure (away from the middle of all the points).
      const auto = Math.sign(nx * (mid[0] - cx) + ny * (mid[1] - cy)) || 1;
      const side = o.side ?? auto;
      // A long label beside a steep segment needs room for its width.
      const off = fs * 0.85 + Math.abs(nx) * String(o.label).length * fs * 0.26;
      text(mid[0] + nx * off * side, mid[1] + ny * off * side, o.label, { class: `fig-text ${o.color != null ? 'tinted' : ''}`, fill: o.color != null ? color(o.color) : null });
    }
    for (let t = 0; t < (o.ticks || 0); t++) {
      const c = toward(mid, B, (t - (o.ticks - 1) / 2) * fs * 0.35);
      line([c[0] + nx * fs * 0.3, c[1] + ny * fs * 0.3], [c[0] - nx * fs * 0.3, c[1] - ny * fs * 0.3], { 'stroke-width': sw * 1.3 });
    }
  }
  // Parallel marks: one or two chevrons at the middle of each segment of a pair.
  (fig.par || []).forEach((pair, k) => {
    for (const [a, b] of pair) {
      const A = P(a), B = P(b);
      const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      for (let t = 0; t <= k; t++) {
        const c = toward(mid, B, t * fs * 0.45);
        const back = toward(c, A, fs * 0.4);
        const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L, ny = dx / L;
        line(c, [back[0] + nx * fs * 0.35, back[1] + ny * fs * 0.35], { 'stroke-width': sw * 1.3 });
        line(c, [back[0] - nx * fs * 0.35, back[1] - ny * fs * 0.35], { 'stroke-width': sw * 1.3 });
      }
    }
  });
  for (const a of fig.angles || []) {
    const V = P(a.at), F = P(a.from), T = P(a.to);
    const r = range * (a.r ?? 0.16);
    const a1 = Math.atan2(F[1] - V[1], F[0] - V[0]);
    const a2 = Math.atan2(T[1] - V[1], T[0] - V[0]);
    let sweep = a2 - a1;
    while (sweep <= -Math.PI) sweep += 2 * Math.PI;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    const col = color(a.color);
    if (a.right) {
      const s = r * 0.75;
      const p1 = toward(V, F, s), p2 = toward(V, T, s);
      const corner = [p1[0] + p2[0] - V[0], p1[1] + p2[1] - V[1]];
      svg.append(svgEl('polyline', { points: `${p1[0]},${-p1[1]} ${corner[0]},${-corner[1]} ${p2[0]},${-p2[1]}`, fill: 'none', stroke: col, 'stroke-width': sw * 1.3 }));
    } else {
      const s = [V[0] + r * Math.cos(a1), V[1] + r * Math.sin(a1)];
      const e = [V[0] + r * Math.cos(a2), V[1] + r * Math.sin(a2)];
      // SVG's y axis points down, so a counter-clockwise maths sweep is drawn with sweep-flag 0.
      const flag = sweep > 0 ? 0 : 1;
      svg.append(svgEl('path', { d: `M${V[0]},${-V[1]} L${s[0]},${-s[1]} A${r},${r} 0 0 ${flag} ${e[0]},${-e[1]} Z`, fill: col, 'fill-opacity': 0.22, stroke: col, 'stroke-width': sw }));
      for (let t = 1; t < (a.marks || 1); t++) {
        const rr = r * (1 - t * 0.22);
        const s2 = [V[0] + rr * Math.cos(a1), V[1] + rr * Math.sin(a1)], e2 = [V[0] + rr * Math.cos(a2), V[1] + rr * Math.sin(a2)];
        svg.append(svgEl('path', { d: `M${s2[0]},${-s2[1]} A${rr},${rr} 0 0 ${flag} ${e2[0]},${-e2[1]}`, fill: 'none', stroke: col, 'stroke-width': sw }));
      }
    }
    if (a.label != null) {
      const bis = a1 + sweep / 2;
      const d = r * (a.right ? 1.9 : 1.75);
      text(V[0] + d * Math.cos(bis), V[1] + d * Math.sin(bis), a.label, { class: 'fig-text tinted', fill: col });
    }
  }
  if (fig.names) {
    for (const [name, p] of Object.entries(pts)) {
      if (name.startsWith('_')) continue;
      const vx = p[0] - cx, vy = p[1] - cy, L = Math.hypot(vx, vy) || 1;
      text(p[0] + (vx / L) * fs * 1.1, p[1] + (vy / L) * fs * 1.1, name, { class: 'fig-text name' });
      svg.append(svgEl('circle', { cx: p[0], cy: -p[1], r: sw * 2.2, class: 'fig-dot' }));
    }
  }
  for (const t of fig.texts || []) text(t.at[0], t.at[1], t.text, { class: `fig-text ${t.cls || ''}` });
  return el('div', { class: `fig-wrap ${small ? 'small' : ''}`, dir: 'ltr' }, svg);
}

// Hebrew next to numbers keeps the numbers left-to-right.
const txt = (s) => (/[֐-׿]/.test(String(s)) ? mixed(s) : [el('span', { dir: 'ltr', class: 'formula' }, String(s))]);
const put = (root, ...nodes) => root.append(...nodes.flat().filter((x) => x != null && x !== false));

// Every geo exercise opens like a think one: the question, an optional hint; the figure sits in the interaction.
function head(root, ex, track) {
  const hint = ex.hint_he ? el('p', { class: 'think-hint', hidden: true }, '💡 ', ...mixed(ex.hint_he)) : null;
  const hintBtn = ex.hint_he ? el('button', { class: 'hint-btn', type: 'button', onclick: () => { hint.hidden = false; hintBtn.hidden = true; track?.('hint', ''); } }, '💡 רמז') : null;
  put(root, el('h2', { class: 'ex-title think-title' }, el('span', { class: 'think-q' }, ...mixed(ex.prompt_he))),
    ...(ex.body_he || []).map((p) => el('p', { class: 'teach-body' }, ...mixed(p))));
  return () => { if (hintBtn) put(root, el('div', { class: 'hint-row' }, hintBtn, hint)); };
}

// ---- Pythagoras explorer ----
//
// A right triangle whose legs slide (1..max), with the square on each side drawn
// and its area written in. Modes: explore (just look), or a target: ex.answer is
// the hypotenuse to reach (fixed_a locks one leg), e.g. "make the hypotenuse 10".
export function renderPyth(root, ex, { setReady, track }) {
  const foot = head(root, ex, track);
  const max = ex.max ?? 12;
  let a = ex.a ?? 3, b = ex.b ?? 4;
  const unitGrid = ex.grid !== false;
  const svg = svgEl('svg', { class: 'pyth-svg', role: 'img', 'aria-label': 'משולש ישר זווית עם ריבועים על צלעותיו' });
  const eq = el('div', { class: 'pyth-eq', dir: 'ltr' });
  const draw = () => {
    svg.replaceChildren();
    const c = Math.hypot(a, b);
    // Triangle: right angle at the origin, leg a along x, leg b along y. Squares outward.
    const O = [0, 0], A = [a, 0], B = [0, b];
    // Square on the hypotenuse: outward normal from (A->B) pointing away from O.
    const nx = b / c, ny = a / c;
    const C1 = [A[0] + nx * c, A[1] + ny * c], C2 = [B[0] + nx * c, B[1] + ny * c];
    const xs = [-b, a, C1[0], C2[0]], ys = [-a, b, C1[1], C2[1]];
    const minX = Math.min(...xs) - 0.6, maxX = Math.max(...xs) + 0.6, minY = Math.min(...ys) - 0.6, maxY = Math.max(...ys) + 0.6;
    svg.setAttribute('viewBox', `${minX} ${-maxY} ${maxX - minX} ${maxY - minY}`);
    const range = Math.max(maxX - minX, maxY - minY);
    const fs = range * 0.065;
    const sq = (pts, col, cls) => svg.append(svgEl('polygon', { points: pts.map((p) => `${p[0]},${-p[1]}`).join(' '), class: `pyth-sq ${cls}`, fill: col, stroke: col }));
    sq([O, A, [a, -a], [0, -a]], PALETTE[0], 'a');
    sq([O, B, [-b, b], [-b, 0]], PALETTE[1], 'b');
    sq([A, B, C2, C1], PALETTE[2], 'c');
    // Unit grid inside the leg squares makes the areas countable.
    if (unitGrid && a <= 12 && b <= 12) {
      const g = (x1, y1, x2, y2) => svg.append(svgEl('line', { x1, y1: -y1, x2, y2: -y2, class: 'pyth-grid' }));
      for (let i = 1; i < a; i++) { g(i, 0, i, -a); g(0, -i, a, -i); }
      for (let i = 1; i < b; i++) { g(-i, 0, -i, b); g(-b, i, 0, i); }
    }
    svg.append(svgEl('polygon', { points: `0,0 ${a},0 0,${-b}`, class: 'pyth-tri' }));
    svg.append(svgEl('polyline', { points: `${0.5},0 ${0.5},${-0.5} 0,${-0.5}`, class: 'pyth-right' }));
    const label = (x, y, s, cls = '') => svg.append(svgEl('text', { x, y: -y, 'font-size': fs, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: `fig-text ${cls}` }, s));
    label(a / 2, -a / 2, `a² = ${a * a}`, 'on-a');
    label(-b / 2, b / 2, `b² = ${b * b}`, 'on-b');
    const cc = [(A[0] + C2[0]) / 2, (A[1] + C2[1]) / 2];
    label(cc[0], cc[1], `c² = ${a * a + b * b}`, 'on-c');
    // Side letters sit inside the triangle; the lengths are on the sliders and in the equation.
    label(a / 2, fs * 0.75, 'a', 'side');
    label(fs * 0.75, b / 2, 'b', 'side');
    label((A[0] + B[0]) / 2 - nx * fs * 0.85, (A[1] + B[1]) / 2 - ny * fs * 0.85, 'c', 'side');
    const isInt = Number.isInteger(c);
    eq.replaceChildren(
      el('span', { class: 'pe a' }, `${a * a}`), ' + ', el('span', { class: 'pe b' }, `${b * b}`), ' = ', el('span', { class: 'pe c' }, `${a * a + b * b}`),
      el('span', { class: 'pe-root' }, `  c = √${a * a + b * b} ${isInt ? '=' : '≈'} ${fmt(c)}`));
    return c;
  };
  const slider = (name, get, set) => {
    const inp = el('input', { type: 'range', class: 'nl-range', min: 1, max, step: 1, value: get(), 'aria-label': `אורך הניצב ${name}` });
    const out = el('span', { class: 'pyth-val' }, `${name} = ${get()}`);
    inp.addEventListener('input', () => { set(Number(inp.value)); out.textContent = `${name} = ${inp.value}`; draw(); setReady(true); });
    inp.addEventListener('change', () => track?.('slide', `${name}=${inp.value}`));
    return el('label', { class: 'pyth-slider', dir: 'ltr' }, out, el('div', { class: 'nl-track' }, inp));
  };
  const controls = el('div', { class: 'pyth-controls' },
    ex.fixed_a ? el('div', { class: 'pyth-fixed', dir: 'ltr' }, `a = ${a} (נתון)`) : slider('a', () => a, (v) => { a = v; }),
    slider('b', () => b, (v) => { b = v; }));
  put(root, el('div', { class: 'pyth-wrap', dir: 'ltr' }, svg, eq, controls));
  draw();
  foot();
  if (ex.explore) return { getAnswer: () => null, info: true };
  const target = Number(ex.answer);
  return {
    getAnswer: () => `${a},${b}`,
    check: () => a * a + b * b === target * target,
    expectedText: () => (ex.solution ? `a = ${ex.solution[0]}, b = ${ex.solution[1]}` : `c = ${target}`),
    reveal: () => { if (ex.solution) { [a, b] = ex.solution; controls.querySelectorAll('input').forEach((i, k) => { i.value = ex.fixed_a ? b : [a, b][k]; }); draw(); } },
  };
}

// ---- coordinate plane: tap a lattice point ----
//
// ex.range (half-width, default 6), ex.points: [{x, y, label, color}], ex.segs: [[i, j]] (indices into points),
// ex.rt: draw the dashed legs of the right triangle under segment 0 (for distances). ex.lines: [[{x, y}, {x, y}]] whole lines.
// ex.answer: [x, y] or a list of acceptable [x, y]. ex.explore: just a picture.
export function renderPlot(root, ex, { setReady, track }) {
  const foot = head(root, ex, track);
  const R = ex.range ?? 6;
  const svg = svgEl('svg', { class: 'plot-svg', viewBox: `${-R - 0.9} ${-R - 0.9} ${2 * R + 1.8} ${2 * R + 1.8}`, role: 'img', 'aria-label': 'מערכת צירים' });
  const fs = R * 0.11;
  const sw = R * 0.012;
  const line = (x1, y1, x2, y2, attrs) => svg.append(svgEl('line', { x1, y1: -y1, x2, y2: -y2, ...attrs }));
  for (let i = -R; i <= R; i++) {
    line(i, -R, i, R, { class: `fig-grid ${i === 0 ? 'axis' : ''}`, 'stroke-width': i === 0 ? sw * 1.6 : sw * 0.6 });
    line(-R, i, R, i, { class: `fig-grid ${i === 0 ? 'axis' : ''}`, 'stroke-width': i === 0 ? sw * 1.6 : sw * 0.6 });
    if (i && Math.abs(i) % (R > 6 ? 2 : 1) === 0) {
      svg.append(svgEl('text', { x: i, y: 0.5, 'font-size': fs * 0.8, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'fig-text axis' }, i));
      svg.append(svgEl('text', { x: -0.5, y: -i, 'font-size': fs * 0.8, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'fig-text axis' }, i));
    }
  }
  svg.append(svgEl('text', { x: R + 0.5, y: 0.5, 'font-size': fs, class: 'fig-text axis', 'text-anchor': 'middle' }, 'x'));
  svg.append(svgEl('text', { x: -0.5, y: -R - 0.4, 'font-size': fs, class: 'fig-text axis', 'text-anchor': 'middle' }, 'y'));
  const pts = ex.points || [];
  svg.append(svgEl('defs', {}, svgEl('clipPath', { id: 'plot-clip' }, svgEl('rect', { x: -R, y: -R, width: 2 * R, height: 2 * R }))));
  const given = svgEl('g');
  svg.append(given);
  const drawGiven = () => {
    given.replaceChildren();
    // Whole lines (a linear function's graph): through two points, out to the edge of the grid.
    for (const [p, q] of ex.lines || []) {
      const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1, k = (3 * R) / L;
      given.append(svgEl('line', { x1: p.x - dx * k, y1: -(p.y - dy * k), x2: q.x + dx * k, y2: -(q.y + dy * k), class: 'plot-seg', 'stroke-width': sw * 2, 'clip-path': 'url(#plot-clip)' }));
    }
    for (const [i, j] of ex.segs || []) {
      const p = pts[i], q = pts[j];
      given.append(svgEl('line', { x1: p.x, y1: -p.y, x2: q.x, y2: -q.y, class: 'plot-seg', 'stroke-width': sw * 2.2 }));
    }
    if (ex.rt && pts.length >= 2) {
      const [p, q] = pts;
      const K = { x: q.x, y: p.y };
      const dash = (a, b) => given.append(svgEl('line', { x1: a.x, y1: -a.y, x2: b.x, y2: -b.y, class: 'plot-leg', 'stroke-width': sw * 1.6, 'stroke-dasharray': `${sw * 5} ${sw * 5}` }));
      dash(p, K); dash(K, q);
      given.append(svgEl('text', { x: (p.x + K.x) / 2, y: -(p.y - 0.55 * Math.sign(q.y - p.y || 1)), 'font-size': fs * 0.9, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'fig-text tinted' }, Math.abs(q.x - p.x)));
      given.append(svgEl('text', { x: K.x + 0.6 * Math.sign(q.x - p.x || 1), y: -(K.y + q.y) / 2, 'font-size': fs * 0.9, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'fig-text tinted' }, Math.abs(q.y - p.y)));
    }
    pts.forEach((p) => {
      given.append(svgEl('circle', { cx: p.x, cy: -p.y, r: R * 0.035, class: 'plot-pt', fill: color(p.color) }));
      if (p.label) given.append(svgEl('text', { x: p.x + 0.45, y: -p.y - 0.45, 'font-size': fs, class: 'fig-text name', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, p.label));
    });
  };
  drawGiven();
  let picked = null;
  const mark = svgEl('g', { class: 'plot-mark', visibility: 'hidden' },
    svgEl('circle', { r: R * 0.06, class: 'plot-pick' }),
    svgEl('circle', { r: R * 0.11, class: 'plot-pick-ring' }));
  const label = svgEl('text', { 'font-size': fs, class: 'fig-text pick', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
  svg.append(mark, label);
  const readout = el('div', { class: 'plot-readout', dir: 'ltr' }, 'לחצו על נקודה');
  const choose = (x, y) => {
    picked = [x, y];
    mark.setAttribute('transform', `translate(${x} ${-y})`);
    mark.setAttribute('visibility', 'visible');
    mark.classList.remove('pop'); void mark.getBoundingClientRect(); mark.classList.add('pop');
    label.setAttribute('x', x); label.setAttribute('y', -y - 0.6);
    label.textContent = `(${x}, ${y})`;
    readout.textContent = `(${x}, ${y})`;
    track?.('point', `${x},${y}`);
    setReady(true);
  };
  if (!ex.explore) {
    svg.classList.add('tappable');
    svg.addEventListener('click', (e) => {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const m = svg.getScreenCTM(); if (!m) return;
      const p = pt.matrixTransform(m.inverse());
      const x = Math.max(-R, Math.min(R, Math.round(p.x))), y = Math.max(-R, Math.min(R, Math.round(-p.y)));
      choose(x, y);
    });
  }
  put(root, el('div', { class: 'plot-wrap', dir: 'ltr' }, svg, ex.explore ? null : readout));
  foot();
  if (ex.explore) return { getAnswer: () => null, info: true };
  const answers = Array.isArray(ex.answer[0]) ? ex.answer : [ex.answer];
  const same = (p, q) => p && q && p[0] === q[0] && p[1] === q[1];
  return {
    getAnswer: () => (picked ? `(${picked[0]}, ${picked[1]})` : null),
    check: () => answers.some((a) => same(a, picked)),
    expectedText: () => `(${answers[0][0]}, ${answers[0][1]})`,
    reveal: () => { choose(answers[0][0], answers[0][1]); mark.classList.add('answer'); },
  };
}

// ---- angles at crossing lines ----
//
// kind 'cross': two lines meeting, angles 1-4 around the point (1 is the upper-right one, counter-clockwise).
// kind 'parallel': two parallel lines and a transversal, angles 1-4 at the top point, 5-8 at the bottom one.
// ex.theta: slope angle of the transversal (degrees). ex.given: {id: '70°'} labels shown.
// ex.answer: the id, or a list of acceptable ids, to tap. ex.explore shows all eight numbers.
export function renderAngles(root, ex, { setReady, track }) {
  const foot = head(root, ex, track);
  const theta = ((ex.theta ?? 60) * Math.PI) / 180;
  const parallel = ex.kind !== 'cross';
  const W = 10, H = parallel ? 7 : 5;
  const svg = svgEl('svg', { class: 'angles-svg', viewBox: `${-W / 2} ${-H / 2} ${W} ${H}`, role: 'img', 'aria-label': 'זוויות בין ישרים' });
  const sw = 0.06;
  const line = (x1, y1, x2, y2, cls) => svg.append(svgEl('line', { x1, y1: -y1, x2, y2: -y2, class: cls, 'stroke-width': sw * 1.4 }));
  const centres = parallel ? [[0, 1.6], [0, -1.6]] : [[0, 0]];
  const dirT = [Math.cos(theta), Math.sin(theta)];
  // The transversal passes through both centres, so the lower centre is shifted along it.
  if (parallel) { const dy = 3.2; centres[1] = [-dy / Math.tan(theta), -1.6]; }
  for (const [cx, cy] of centres) line(cx - 6, cy, cx + 6, cy, 'ang-line');
  const [c0, c1] = parallel ? centres : [centres[0], centres[0]];
  line(c0[0] + dirT[0] * 9, c0[1] + dirT[1] * 9, c1[0] - dirT[0] * 9, c1[1] - dirT[1] * 9, 'ang-line');
  if (parallel) {
    for (const [cx, cy] of centres) for (const dx of [4.6, 5.1]) { line(cx + dx, cy, cx + dx - 0.35, cy + 0.25, 'ang-line'); line(cx + dx, cy, cx + dx - 0.35, cy - 0.25, 'ang-line'); }
  }
  // Angle regions: around each centre, four sectors between the horizontal and the transversal.
  const deg = (ex.theta ?? 60);
  const sectors = [];
  centres.forEach(([cx, cy], k) => {
    const base = k * 4;
    // sectors counter-clockwise from the positive x axis: 1: 0..theta, 2: theta..180, 3: 180..180+theta, 4: 180+theta..360
    const bounds = [[0, deg], [deg, 180], [180, 180 + deg], [180 + deg, 360]];
    bounds.forEach(([s, e], i) => sectors.push({ id: base + i + 1, cx, cy, s, e, size: e - s }));
  });
  const pickedSet = new Set();
  const nodes = new Map();
  const r = 1.05;
  const arc = (sec, rr, cls) => {
    const a1 = (sec.s * Math.PI) / 180, a2 = (sec.e * Math.PI) / 180;
    const p1 = [sec.cx + rr * Math.cos(a1), sec.cy + rr * Math.sin(a1)], p2 = [sec.cx + rr * Math.cos(a2), sec.cy + rr * Math.sin(a2)];
    return svgEl('path', { d: `M${sec.cx},${-sec.cy} L${p1[0]},${-p1[1]} A${rr},${rr} 0 0 0 ${p2[0]},${-p2[1]} Z`, class: cls });
  };
  for (const sec of sectors) {
    const g = svgEl('g', { class: 'ang-sector', role: ex.explore ? null : 'button', tabindex: ex.explore ? null : 0, 'aria-label': `זווית ${sec.id}` });
    g.append(arc(sec, r, 'ang-fill'));
    const mid = ((sec.s + sec.e) / 2) * (Math.PI / 180);
    const lx = sec.cx + r * 0.62 * Math.cos(mid), ly = sec.cy + r * 0.62 * Math.sin(mid);
    const given = ex.given?.[sec.id];
    g.append(svgEl('text', { x: lx, y: -ly, 'font-size': given ? 0.42 : 0.38, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: `fig-text ${given ? 'given' : 'num'}` }, given || (ex.numbers === false ? '' : sec.id)));
    if (given) g.classList.add('given');
    if (!ex.explore) {
      const pick = () => {
        if (ex.multi) { pickedSet.has(sec.id) ? pickedSet.delete(sec.id) : pickedSet.add(sec.id); }
        else { pickedSet.clear(); pickedSet.add(sec.id); }
        nodes.forEach((n, id) => n.classList.toggle('picked', pickedSet.has(id)));
        track?.('angle', sec.id);
        setReady(pickedSet.size > 0);
      };
      g.addEventListener('click', pick);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    }
    nodes.set(sec.id, g);
    svg.append(g);
  }
  if (ex.legend) put(root, el('p', { class: 'muted ang-legend' }, ...mixed(ex.legend)));
  put(root, el('div', { class: 'angles-wrap', dir: 'ltr' }, svg));
  foot();
  if (ex.explore) return { getAnswer: () => null, info: true };
  const want = (Array.isArray(ex.answer) ? ex.answer : [ex.answer]).map(Number);
  const ok = () => (ex.multi ? want.length === pickedSet.size && want.every((w) => pickedSet.has(w)) : want.includes([...pickedSet][0]));
  return {
    getAnswer: () => [...pickedSet].join(','),
    check: ok,
    expectedText: () => (ex.multi ? `זוויות ${want.join(', ')}` : `זווית ${want[0]}`),
    reveal: () => { nodes.forEach((n, id) => n.classList.toggle('answer', want.includes(id))); },
  };
}

// ---- blitz: a timed quick-fire round (a game, never a mistake) ----
//
// ex.pool: 'squares' | 'roots' | 'triples' | 'angles' | 'powers' | 'mixed'; ex.seconds (default 45).
// Four answers per question, score and best streak at the end. Pure fun: it counts as read.
const BLITZ = {
  squares: (r) => { const n = 2 + Math.floor(r() * 14); return { q: `${n}² = ?`, a: n * n, w: [n * n + n, (n + 1) * (n + 1), n * 2] }; },
  roots: (r) => { const n = 2 + Math.floor(r() * 14); return { q: `√${n * n} = ?`, a: n, w: [n + 1, n - 1, n * n / 2] }; },
  triples: (r) => {
    const T = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25], [12, 16, 20], [15, 20, 25], [9, 40, 41], [20, 21, 29]];
    const [a, b, c] = T[Math.floor(r() * T.length)];
    return r() < 0.6 ? { q: `ניצבים ${a} ו-${b}. יתר?`, a: c, w: [c + 1, c - 1, a + b] } : { q: `יתר ${c}, ניצב ${a}. ניצב שני?`, a: b, w: [b + 1, b - 1, c - a] };
  },
  angles: (r) => { const a = 20 + Math.floor(r() * 12) * 5, b = 20 + Math.floor(r() * (28 - a / 5)) * 5; const c = 180 - a - b; return { q: `במשולש ${a}° ו-${b}°. השלישית?`, a: c, w: [c + 10, c - 10, 180 - a] }; },
  powers: (r) => { const b = [2, 3, 5, 10][Math.floor(r() * 4)], e = b === 2 ? 2 + Math.floor(r() * 6) : 2 + Math.floor(r() * 2); return { q: `${b}^${e} = ?`, a: b ** e, w: [b * e, b ** e * b, b ** e - b] }; },
};
BLITZ.mixed = (r) => { const keys = ['squares', 'roots', 'triples', 'angles', 'powers']; return BLITZ[keys[Math.floor(r() * keys.length)]](r); };

export function renderBlitz(root, ex, { track }) {
  const foot = head(root, ex, track);
  const total = ex.seconds ?? 45;
  const gen = BLITZ[ex.pool] || BLITZ.mixed;
  let left = total, score = 0, streak = 0, best = 0, timer = null, locked = false;
  const clock = el('div', { class: 'blitz-clock' }, `${total}`);
  const ring = el('div', { class: 'blitz-ring', style: '--pct: 100' }, clock);
  const scoreEl = el('div', { class: 'blitz-score' }, '⭐ 0');
  const q = el('div', { class: 'blitz-q', dir: 'auto' });
  const grid = el('div', { class: 'choice-grid blitz-grid' });
  const stage = el('div', { class: 'blitz' }, el('div', { class: 'blitz-top' }, ring, scoreEl), q, grid);
  const startBtn = el('button', { class: 'btn primary wide', type: 'button' }, '🚀 התחלה');
  const intro = el('div', { class: 'blitz-intro' }, el('p', {}, `${total} שניות, כמה שיותר תשובות נכונות. כל שאלה: ארבע אפשרויות.`), startBtn);
  put(root, intro);
  const ask = () => {
    const { q: text, a, w } = gen(Math.random);
    const opts = [...new Set([a, ...w.map((x) => Math.round(x))].filter((x) => x > 0))].slice(0, 4);
    while (opts.length < 4) opts.push(a + opts.length * 3);
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    q.replaceChildren(...txt(text));
    q.classList.remove('slide'); void q.offsetWidth; q.classList.add('slide');
    locked = false;
    grid.replaceChildren(...opts.map((o) => el('button', { class: 'choice-card think-choice blitz-opt', type: 'button', onclick: (e) => {
      if (locked) return;
      locked = true;
      const right = o === a;
      e.currentTarget.classList.add(right ? 'answer' : 'was-wrong');
      if (right) { score++; streak++; best = Math.max(best, streak); } else { streak = 0; grid.querySelectorAll('.blitz-opt').forEach((b) => { if (Number(b.dataset.v) === a) b.classList.add('answer'); }); }
      scoreEl.textContent = `⭐ ${score}${streak >= 3 ? ` · ${streak} ברצף 🔥` : ''}`;
      scoreEl.classList.remove('bump'); void scoreEl.offsetWidth; scoreEl.classList.add('bump');
      setTimeout(ask, right ? 350 : 900);
    }, 'data-v': o }, String(o))));
  };
  const finish = () => {
    clearInterval(timer);
    const stars = score >= 15 ? 3 : score >= 9 ? 2 : score >= 4 ? 1 : 0;
    track?.('blitz', `${score}/${best}`);
    stage.replaceChildren(el('div', { class: 'blitz-end' },
      el('div', { class: 'blitz-stars' }, '⭐'.repeat(stars) + '☆'.repeat(3 - stars)),
      el('div', { class: 'blitz-big' }, `${score} נכונות`),
      el('p', { class: 'muted' }, best >= 3 ? `הרצף הטוב ביותר: ${best} 🔥` : 'בפעם הבאה אפשר לשבור את השיא'),
      el('button', { class: 'btn', type: 'button', onclick: () => { left = total; score = 0; streak = 0; best = 0; stage.replaceChildren(el('div', { class: 'blitz-top' }, ring, scoreEl), q, grid); scoreEl.textContent = '⭐ 0'; run(); } }, '🔁 עוד סיבוב')));
  };
  const run = () => {
    clock.textContent = left;
    ring.style.setProperty('--pct', 100);
    ask();
    timer = setInterval(() => {
      left--;
      clock.textContent = left;
      ring.style.setProperty('--pct', Math.round((left / total) * 100));
      ring.classList.toggle('low', left <= 10);
      if (left <= 0) finish();
    }, 1000);
  };
  startBtn.addEventListener('click', () => { intro.replaceWith(stage); run(); });
  foot();
  // Leaving the lesson mid-round must not leave a ticking timer.
  const observer = new MutationObserver(() => { if (!root.isConnected) { clearInterval(timer); observer.disconnect(); } });
  observer.observe(document.body, { childList: true, subtree: true });
  return { getAnswer: () => null, info: true, nextLabel: 'ממשיכים' };
}
