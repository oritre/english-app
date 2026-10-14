import { el, en } from '../util.js';
import { speak } from '../speech.js';
import { checkSpeech } from '../check.js';
import { getSettings } from '../settings.js';
import { measureMic, micMeter, HEARD_LEVEL, MIC_OK_TIP, MIC_SILENT_TIP, micErrorTip } from '../micTest.js';

export const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
const PAUSE_KEY = 'english_app_speak_paused_until';

export function speakSupported() {
  if (!Recognition || !getSettings().speaking) return false;
  try { return Number(localStorage.getItem(PAUSE_KEY) || 0) < Date.now(); } catch { return true; }
}

function pauseSpeaking(minutes) {
  try { localStorage.setItem(PAUSE_KEY, String(Date.now() + minutes * 60e3)); } catch { /* storage blocked */ }
}

// Read an English sentence aloud. The browser transcribes it, and each word
// lights up green or red. Passing needs every word.
export function renderSpeak(root, ex, { setReady, finish, skip, gloss = (t) => [t] }) {
  let result = null;
  let rec = null;
  let tries = 0;
  // After an empty attempt, retry in the plainest mode: some Android builds
  // return nothing when interim results or alternatives are requested.
  let simple = false;
  const words = el('div', { class: 'speak-words', dir: 'ltr', lang: 'en' },
    ex.text.split(' ').map((w) => el('span', { class: 'sw' }, ...gloss(w))));
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
    try { speechSynthesis.cancel(); } catch { /* no TTS */ }
    rec = new Recognition();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = !simple;
    rec.maxAlternatives = simple ? 1 : 3;
    let finalAlts = [];
    let lastAlts = [];
    let gotAudio = false;
    let gotSpeech = false;
    let failed = false;
    rec.onaudiostart = () => { gotAudio = true; };
    rec.onsoundstart = () => { gotAudio = true; };
    rec.onspeechstart = () => { gotAudio = true; gotSpeech = true; status.textContent = 'מקשיב... (שומע דיבור)'; };
    mic.classList.add('on');
    status.textContent = 'מקשיב...';
    rec.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      const alts = Array.from(res, (a) => a.transcript);
      heard.hidden = false;
      heard.textContent = `שמעתי: "${alts[0]}"`;
      lastAlts = alts;
      if (res.isFinal) finalAlts = alts;
    };
    rec.onerror = (e) => {
      if (e.error !== 'aborted') failed = true;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        status.textContent = 'אין גישה למיקרופון כאן. אפשר לדלג על תרגילי דיבור.';
        skipBtn.textContent = 'דילוג על תרגילי דיבור';
      } else if (e.error === 'no-speech') {
        status.textContent = 'לא שמעתי כלום. נסו שוב, קרוב יותר למיקרופון.';
      } else if (e.error === 'network') {
        status.textContent = navigator.brave
          ? 'דפדפן Brave לא מתמלל דיבור. פתחו את האפליקציה ב־Chrome או ב־Edge כדי לתרגל דיבור.'
          : 'התמלול צריך חיבור לאינטרנט, ובחלק מהדפדפנים הוא לא זמין. בדקו את החיבור, או נסו ב־Chrome או ב־Edge.';
        skipBtn.textContent = 'דילוג על תרגילי דיבור';
      } else if (e.error === 'language-not-supported') {
        status.textContent = 'הדפדפן הזה לא מתמלל אנגלית. נסו ב־Chrome או ב־Edge.';
      } else if (e.error !== 'aborted') {
        status.textContent = `ההקלטה נכשלה (${e.error || 'שגיאה לא ידועה'}). נסו שוב.`;
      }
    };
    rec.onend = () => {
      mic.classList.remove('on');
      rec = null;
      // Stopped before the browser finalised: judge what it heard so far.
      if (!finalAlts.length) finalAlts = lastAlts;
      if (!finalAlts.length) {
        if (failed) return;
        simple = true;
        if (!gotAudio) {
          status.textContent = 'לא הגיע קול לתמלול. לחצו על "בדיקת מיקרופון" כדי לבדוק אם המיקרופון קולט.';
          micTest.hidden = false;
        } else if (gotSpeech) {
          status.textContent = 'שמעתי דיבור אבל לא הצלחתי לתמלל אותו. לחצו שוב, דברו ברור, וחכו שהמיקרופון ייכבה לבד.';
        } else {
          status.textContent = 'המיקרופון פעל אבל לא זיהיתי דיבור. לחצו שוב ודברו קרוב יותר לטלפון.';
        }
        return;
      }
      tries++;
      result = checkSpeech(finalAlts, ex.text, ex.alternatives || []);
      paint(result);
      if (result.pass) {
        status.textContent = 'מצוין!';
        setReady(true);
        finish(tries === 1);
      } else {
        const missed = result.words.filter((w) => !w.ok).length;
        status.textContent = result.score >= 0.5
          ? `כמעט. ${missed === 1 ? 'מילה אחת לא נשמעה' : `${missed} מילים לא נשמעו`} נכון (באדום). נסו שוב.`
          : 'לא הצלחתי לזהות את המשפט. נסו שוב, לאט וברור.';
      }
    };
    try { rec.start(); } catch { mic.classList.remove('on'); rec = null; }
  });

  // Records 3 seconds without speech recognition: tells a dead mic apart
  // from a phone whose speech service gets no microphone.
  const { meter, show, hide } = micMeter();
  const micTest = el('button', { class: 'link-btn', type: 'button', hidden: true }, 'בדיקת מיקרופון');
  micTest.addEventListener('click', async () => {
    if (rec) rec.abort();
    micTest.disabled = true;
    status.textContent = 'בודק... דברו עכשיו 3 שניות.';
    try {
      status.textContent = (await measureMic(3, show)) > HEARD_LEVEL ? MIC_OK_TIP : MIC_SILENT_TIP;
    } catch (err) {
      status.textContent = micErrorTip(err);
    } finally {
      hide();
      micTest.disabled = false;
    }
  });

  const skipBtn = el('button', { class: 'link-btn', type: 'button' }, 'לא יכול לדבר עכשיו');
  skipBtn.addEventListener('click', () => { if (rec) rec.abort(); pauseSpeaking(15); skip(); });

  root.append(
    el('h2', { class: 'ex-title' }, 'קראו בקול'),
    el('div', { class: 'prompt-bubble speak-prompt' },
      el('button', { class: 'speaker', type: 'button', 'aria-label': 'השמע', onclick: () => speak(ex.text) }, '🔊'),
      words),
    el('div', { class: 'mic-row' }, mic), status, meter, heard, micTest, skipBtn);
  return { getAnswer: () => null, selfChecking: true };
}
