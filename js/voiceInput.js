import { el } from './util.js';
import { Recognition, asrEngine, localAsrUsable } from './exercises/speak.js';
import { setSetting } from './settings.js';
import { localAsrSupported, loadLocalAsr, recordUtterance, transcribe } from './localAsr.js';
import { micErrorTip } from './micTest.js';

// A 🎤 button under a typing box: the learner says the answer and the
// transcription is written into the box, where it can still be fixed by hand
// before checking. Uses the same speech engine as the speaking exercises.
export function voiceInput(input, { track } = {}) {
  const mic = el('button', { class: 'mic voice-mic', type: 'button', 'aria-label': 'הקלטה במקום הקלדה' }, '🎤');
  const status = el('p', { class: 'muted voice-status', 'aria-live': 'polite' }, 'אפשר גם להקליט: לחצו על המיקרופון ואמרו את התשובה באנגלית');
  const useLocal = el('button', { class: 'link-btn', type: 'button', hidden: true }, '🧠 לתמלל בתוך האפליקציה');
  let rec = null;
  let busy = false;

  const put = (text) => {
    const clean = String(text || '').trim();
    if (!clean) return false;
    input.value = clean;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    track?.('heard', clean);
    status.textContent = 'זה מה ששמעתי. אפשר לתקן בהקלדה, להקליט שוב, או ללחוץ "בדיקה".';
    return true;
  };

  async function localClick() {
    if (busy) { rec?.stop(); return; }
    busy = true;
    useLocal.hidden = true;
    try {
      status.textContent = 'טוען את מנוע התמלול...';
      await loadLocalAsr((f) => { status.textContent = `מוריד את מנוע התמלול: ${Math.round(f * 100)}%`; });
      mic.classList.add('on');
      status.textContent = 'מקשיב... דברו עכשיו';
      rec = recordUtterance({ onSpeech: () => { status.textContent = 'מקשיב... (שומע דיבור)'; } });
      const { audio, heard } = await rec.done;
      mic.classList.remove('on');
      rec = null;
      if (!heard) { status.textContent = 'לא שמעתי כלום. נסו שוב, קרוב יותר למיקרופון.'; return; }
      status.textContent = 'מתמלל...';
      if (!put(await transcribe(audio))) status.textContent = 'לא הצלחתי לתמלל. נסו שוב ודברו ברור.';
    } catch (err) {
      mic.classList.remove('on');
      rec = null;
      status.textContent = err?.name === 'NotAllowedError' ? micErrorTip(err)
        : 'מנוע התמלול לא נטען. בדקו את החיבור לאינטרנט ונסו שוב.';
    } finally {
      busy = false;
    }
  }

  useLocal.addEventListener('click', () => { setSetting('asr', 'local'); localClick(); });

  mic.addEventListener('click', () => {
    if (asrEngine() === 'local') { localClick(); return; }
    if (rec) { rec.stop(); return; }
    try { speechSynthesis.cancel(); } catch { /* no TTS */ }
    rec = new Recognition();
    rec.lang = 'en-US';
    rec.continuous = false;
    // Some Android phones return nothing when interim results or alternatives are asked for.
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let text = '';
    let failed = false;
    mic.classList.add('on');
    status.textContent = 'מקשיב... דברו עכשיו';
    rec.onresult = (e) => { text = Array.from(e.results, (r) => r[0].transcript).join(' '); };
    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      failed = true;
      status.textContent = e.error === 'no-speech' ? 'לא שמעתי כלום. נסו שוב, קרוב יותר למיקרופון.'
        : (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') ? 'אין גישה למיקרופון כאן. אפשר להקליד את התשובה.'
          : 'התמלול לא הצליח. נסו שוב, או עברו לתמלול בתוך האפליקציה.';
      useLocal.hidden = !localAsrUsable() || e.error === 'no-speech';
    };
    rec.onend = () => {
      mic.classList.remove('on');
      rec = null;
      if (put(text) || failed) return;
      status.textContent = 'לא הצלחתי לתמלל. נסו שוב, או עברו לתמלול בתוך האפליקציה.';
      useLocal.hidden = !localAsrUsable();
    };
    try { rec.start(); } catch { mic.classList.remove('on'); rec = null; }
  });

  return el('div', { class: 'voice-input' }, el('div', { class: 'mic-row' }, mic), status, useLocal);
}

export const voiceInputSupported = () => !!Recognition || localAsrSupported();
