import { el, en } from '../util.js';
import { speak } from '../speech.js';
import { checkSpeech } from '../check.js';

const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
const PAUSE_KEY = 'english_app_speak_paused_until';

export function speakSupported() {
  if (!Recognition) return false;
  try { return Number(localStorage.getItem(PAUSE_KEY) || 0) < Date.now(); } catch { return true; }
}

function pauseSpeaking(minutes) {
  try { localStorage.setItem(PAUSE_KEY, String(Date.now() + minutes * 60e3)); } catch { /* storage blocked */ }
}

// Read an English sentence aloud. The browser transcribes it, and each word
// lights up green or red. Passing needs every word.
export function renderSpeak(root, ex, { setReady, finish, skip }) {
  let result = null;
  let rec = null;
  const words = el('div', { class: 'speak-words', dir: 'ltr', lang: 'en' },
    ex.text.split(' ').map((w) => el('span', { class: 'sw' }, w)));
  const heard = el('p', { class: 'heard', dir: 'ltr', hidden: true });
  const status = el('p', { class: 'hint speak-status' }, 'לחצו על המיקרופון וקראו את המשפט בקול');
  const mic = el('button', { class: 'mic', type: 'button', 'aria-label': 'הקלטה' }, '🎤');

  function paint(r) {
    const spans = words.querySelectorAll('.sw');
    spans.forEach((s, i) => { s.classList.toggle('miss', !r.words[i]?.ok); s.classList.toggle('ok', !!r.words[i]?.ok); });
    heard.hidden = false;
    heard.textContent = `שמעתי: "${r.heard}"`;
  }

  mic.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    rec = new Recognition();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    let finalAlts = [];
    mic.classList.add('on');
    status.textContent = 'מקשיב...';
    rec.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      const alts = Array.from(res, (a) => a.transcript);
      heard.hidden = false;
      heard.textContent = `שמעתי: "${alts[0]}"`;
      if (res.isFinal) finalAlts = alts;
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        status.textContent = 'אין גישה למיקרופון כאן. אפשר לדלג על תרגילי דיבור.';
        skipBtn.textContent = 'דילוג על תרגילי דיבור';
      } else if (e.error === 'no-speech') {
        status.textContent = 'לא שמעתי כלום. נסו שוב, קרוב יותר למיקרופון.';
      } else {
        status.textContent = 'ההקלטה נכשלה. נסו שוב.';
      }
    };
    rec.onend = () => {
      mic.classList.remove('on');
      rec = null;
      if (!finalAlts.length) return;
      result = checkSpeech(finalAlts, ex.text, ex.alternatives || []);
      paint(result);
      if (result.pass) {
        status.textContent = 'מצוין!';
        setReady(true);
        finish(true);
      } else {
        const missed = result.words.filter((w) => !w.ok).length;
        status.textContent = result.score >= 0.5
          ? `כמעט. ${missed === 1 ? 'מילה אחת לא נשמעה' : `${missed} מילים לא נשמעו`} נכון (באדום). נסו שוב.`
          : 'לא הצלחתי לזהות את המשפט. נסו שוב, לאט וברור.';
      }
    };
    try { rec.start(); } catch { mic.classList.remove('on'); rec = null; }
  });

  const skipBtn = el('button', { class: 'link-btn', type: 'button' }, 'לא יכול לדבר עכשיו');
  skipBtn.addEventListener('click', () => { if (rec) rec.abort(); pauseSpeaking(15); skip(); });

  root.append(
    el('h2', { class: 'ex-title' }, 'קראו בקול'),
    el('div', { class: 'prompt-bubble speak-prompt' },
      el('button', { class: 'speaker', type: 'button', 'aria-label': 'השמע', onclick: () => speak(ex.text) }, '🔊'),
      words),
    el('div', { class: 'mic-row' }, mic), status, heard, skipBtn);
  return { getAnswer: () => null, selfChecking: true };
}
