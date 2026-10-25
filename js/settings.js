// Device-wide preferences, kept in localStorage (they describe the device,
// not the learner: speaker, microphone, how fast the voice talks).
const KEY = 'english_app_settings';
const DEFAULTS = { rate: 'normal', speaking: true, autoplay: true };
const RATES = { xslow: 0.5, slow: 0.7, normal: 0.9, fast: 1.1, xfast: 1.3 };
// The reading speeds offered in settings and inside every lesson, slowest first.
export const RATE_CHOICES = [['xslow', 'לאט מאוד'], ['slow', 'לאט'], ['normal', 'רגיל'], ['fast', 'מהר'], ['xfast', 'מהר מאוד']];

export function getSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

export function setSetting(name, value) {
  const s = { ...getSettings(), [name]: value };
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
  return s;
}

export function rateFactor() {
  return RATES[getSettings().rate] || 1;
}
