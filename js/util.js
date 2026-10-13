export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

// English text inside the RTL app always gets its own LTR span.
export function en(text, cls = '') {
  return el('span', { dir: 'ltr', lang: 'en', class: `en ${cls}`.trim() }, text);
}

// Hebrew text with English quotes in it ("בטקסט כתוב: My name is Noa."): each
// English run gets its own left-to-right island so its punctuation stays put.
export function mixed(text) {
  const parts = String(text).split(/([A-Za-z][A-Za-z0-9 ,.'’!?/()-]*[A-Za-z0-9.!?)])/);
  return parts.map((p, i) => (i % 2 ? el('bdi', { dir: 'ltr', lang: 'en' }, p) : p));
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
