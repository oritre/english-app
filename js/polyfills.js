// Older browsers (e.g. Chrome 81 on an Android 10 tablet) lack a few newer DOM/JS APIs.
// Imported first by app.js, so it runs before any other module.

for (const proto of [Element.prototype, Document.prototype, DocumentFragment.prototype]) {
  if (!proto.replaceChildren) {
    proto.replaceChildren = function replaceChildren(...nodes) {
      while (this.lastChild) this.removeChild(this.lastChild);
      this.append(...nodes);
    };
  }
}

function at(i) {
  i = Math.trunc(i) || 0;
  if (i < 0) i += this.length;
  return i < 0 || i >= this.length ? undefined : this[i];
}
for (const proto of [Array.prototype, String.prototype]) {
  if (!proto.at) Object.defineProperty(proto, 'at', { value: at, writable: true, configurable: true });
}

if (!Object.hasOwn) {
  Object.defineProperty(Object, 'hasOwn', {
    value: (obj, key) => Object.prototype.hasOwnProperty.call(obj, key), writable: true, configurable: true,
  });
}
