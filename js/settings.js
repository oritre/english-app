// Device-wide preferences, kept in localStorage (they describe the device,
// not the learner: speaker, microphone, how fast the voice talks).
const KEY = 'english_app_settings';
const DEFAULTS = { rate: 'normal', speaking: true, autoplay: true };
const RATES = { slow: 0.75, normal: 1, fast: 1.15 };

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
