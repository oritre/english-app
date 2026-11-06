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
// A formula or a number run ("5⁷ : 5⁴ = 5", "(x + 1)/2 = 4", "−2x + 10") is an
// island too, so its order survives inside a Hebrew sentence.
const ISLAND = /([A-Za-z0-9(−√π][A-Za-z0-9 ,.'’!?/()+=:^×÷−√π²³⁰¹⁴⁵⁶⁷⁸⁹⁻₀₁₂₃₄₅₆₇₈₉≤≥≈°-]*[A-Za-z0-9.!?)°²³⁰¹⁴⁵⁶⁷⁸⁹√π]|[A-Za-z0-9])/;
export function mixed(text) {
  const parts = String(text).split(ISLAND);
  // A period that ends the whole Hebrew sentence belongs to the Hebrew, not to the English island.
  const last = parts.length - 2;
  if (last > 0 && parts[last + 1] === '' && /[^.]\.$/.test(parts[last]) && /[֐-׿]/.test(parts.slice(0, last).join(''))) {
    parts[last] = parts[last].slice(0, -1);
    parts[last + 1] = '.';
  }
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
