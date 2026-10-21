import { el, en } from '../util.js';
import { speak, canSpeak, canSpeakLang, voiceName } from '../speech.js';
import { getSettings, setSetting } from '../settings.js';
import { measureMic, micMeter, HEARD_LEVEL, MIC_OK_TIP, MIC_SILENT_TIP, micErrorTip } from '../micTest.js';
import { Recognition, asrEngine } from '../exercises/speak.js';
import { localAsrSupported, localAsrDownloaded, loadLocalAsr, recordUtterance, transcribe } from '../localAsr.js';
import { getProfile, setCurrentProfile, updateProfile } from '../progress.js';
import { APP_VERSION } from '../version.js';


function section(title, ...children) {
  return el('section', { class: 'settings-card' }, el('h2', {}, title), ...children);
}

function toggle(label, hint, name) {
  const box = el('input', { type: 'checkbox', checked: getSettings()[name] });
  box.addEventListener('change', () => setSetting(name, box.checked));
  return el('label', { class: 'setting-row' },
    el('span', {}, el('span', { class: 'setting-label' }, label), hint ? el('span', { class: 'muted setting-hint' }, hint) : null),
    box);
}

function speakerSection() {
  const status = el('p', { class: 'muted', 'aria-live': 'polite' });
  if (!canSpeak()) status.textContent = 'הדפדפן הזה לא יודע להקריא. נסו ב־Chrome או ב־Edge.';
  const testEn = el('button', { class: 'btn', type: 'button' }, '🔊 בדיקה באנגלית');
  testEn.addEventListener('click', () => {
    speak('Hello! This is a speaker test.');
    status.textContent = `מקריא באנגלית${voiceName('en-US') ? ` (${voiceName('en-US')})` : ''}. שומעים? אם לא, בדקו את עוצמת המדיה בטלפון.`;
  });
  const testHe = el('button', { class: 'btn', type: 'button' }, '🔊 בדיקה בעברית');
  testHe.addEventListener('click', () => {
    if (!canSpeakLang('he-IL')) {
      status.textContent = 'אין במכשיר קול בעברית, לכן מילים חדשות יוקראו רק באנגלית. אפשר להוסיף קול עברי בהגדרות ההקראה של הטלפון.';
      return;
    }
    speak('שלום, זו בדיקת רמקול.', { lang: 'he-IL' });
    status.textContent = 'מקריא בעברית. שומעים?';
  });

  const rates = [['slow', 'איטי'], ['normal', 'רגיל'], ['fast', 'מהיר']];
  const rateBtns = rates.map(([id, label]) => {
    const b = el('button', { class: 'seg-btn', type: 'button', 'aria-pressed': String(getSettings().rate === id) }, label);
    b.addEventListener('click', () => {
      setSetting('rate', id);
      rateBtns.forEach((x, i) => x.setAttribute('aria-pressed', String(rates[i][0] === id)));
      speak('This is the new speed.');
    });
    return b;
  });

  return section('🔊 רמקול',
    el('div', { class: 'row-btns' }, testEn, testHe), status,
    el('div', { class: 'setting-row' }, el('span', { class: 'setting-label' }, 'מהירות ההקראה'), el('div', { class: 'seg' }, rateBtns)),
    toggle('השמעה אחרי תשובה נכונה', 'המשפט באנגלית מוקרא אחרי כל תשובה', 'autoplay'));
}

function micSection() {
  const status = el('p', { class: 'muted', 'aria-live': 'polite' });
  const heard = el('p', { class: 'heard', dir: 'ltr', hidden: true });
  const { meter, show, hide } = micMeter();

  const testMic = el('button', { class: 'btn', type: 'button' }, '🎤 בדיקת מיקרופון');
  testMic.addEventListener('click', async () => {
    testMic.disabled = true;
    status.textContent = 'בודק... דברו עכשיו 3 שניות.';
    try {
      status.textContent = (await measureMic(3, show)) > HEARD_LEVEL ? MIC_OK_TIP : MIC_SILENT_TIP;
    } catch (err) {
      status.textContent = micErrorTip(err);
    } finally {
      hide();
      testMic.disabled = false;
    }
  });

  // Full speech-to-text round trip, the same path speaking exercises use.
  const testRec = el('button', { class: 'btn', type: 'button' }, '📝 בדיקת תמלול');
  testRec.addEventListener('click', async () => {
    if (asrEngine() === 'local') {
      heard.hidden = true;
      testRec.disabled = true;
      try {
        await loadLocalAsr((f) => { status.textContent = `מוריד את מנוע התמלול... ${Math.round(f * 100)}%`; });
        status.textContent = 'אמרו באנגלית: Hello, how are you?';
        const { audio, heard: gotSpeech } = await recordUtterance({ onLevel: show }).done;
        hide();
        if (!gotSpeech) { status.textContent = MIC_SILENT_TIP; return; }
        status.textContent = 'מתמלל...';
        const text = await transcribe(audio);
        heard.hidden = !text;
        heard.textContent = `שמעתי: "${text}"`;
        status.textContent = text ? 'התמלול בתוך האפליקציה עובד.' : 'לא הצלחתי לתמלל. נסו שוב, ברור וקרוב לטלפון.';
      } catch (err) {
        hide();
        status.textContent = err?.name === 'NotAllowedError' ? micErrorTip(err) : 'מנוע התמלול לא נטען. בדקו את החיבור לאינטרנט ונסו שוב.';
      } finally {
        testRec.disabled = false;
      }
      return;
    }
    if (!Recognition) {
      status.textContent = 'הדפדפן הזה לא מתמלל דיבור. נסו ב־Chrome או ב־Edge.';
      return;
    }
    try { speechSynthesis.cancel(); } catch { /* no TTS */ }
    const rec = new Recognition();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let text = '';
    let gotAudio = false;
    let error = '';
    rec.onaudiostart = () => { gotAudio = true; };
    rec.onresult = (e) => { text = e.results[e.results.length - 1][0].transcript; };
    rec.onerror = (e) => { error = e.error; };
    rec.onend = () => {
      testRec.disabled = false;
      if (text) {
        heard.hidden = false;
        heard.textContent = `שמעתי: "${text}"`;
        status.textContent = 'התמלול עובד.';
      } else if (error === 'network') {
        status.textContent = navigator.brave ? 'דפדפן Brave לא מתמלל דיבור. נסו ב־Chrome או ב־Edge.' : 'התמלול צריך חיבור לאינטרנט. בדקו את החיבור.';
      } else if (error === 'not-allowed' || error === 'service-not-allowed') {
        status.textContent = 'אין הרשאת מיקרופון. אשרו ל־Chrome גישה למיקרופון בהגדרות האתר.';
      } else {
        status.textContent = `${gotAudio ? 'הקול הגיע, אבל לא תומלל.' : 'לא הגיע קול לתמלול.'} לחצו על "בדיקת מיקרופון". ${error ? `(קוד: ${error})` : ''}`.trim();
      }
    };
    heard.hidden = true;
    status.textContent = 'אמרו באנגלית: Hello, how are you?';
    testRec.disabled = true;
    try { rec.start(); } catch { testRec.disabled = false; }
  });

  // Which speech-to-text runs: Google's service in the browser, or Whisper on the device.
  const engines = [['google', 'גוגל'], ['local', 'בתוך האפליקציה']];
  const engineNote = el('span', { class: 'muted setting-hint' });
  const noteFor = (id) => (id === 'local'
    ? (localAsrDownloaded() ? 'מותקן במכשיר. עובד גם בלי אינטרנט.' : 'הורדה חד־פעמית של כ־65MB בשימוש הראשון.')
    : 'שירות הזיהוי של הדפדפן. צריך אינטרנט.');
  const engineBtns = engines.map(([id, label]) => {
    const b = el('button', { class: 'seg-btn', type: 'button', 'aria-pressed': String(asrEngine() === id), disabled: (id === 'google' && !Recognition) || (id === 'local' && !localAsrSupported()) }, label);
    b.addEventListener('click', () => {
      setSetting('asr', id);
      // Kept on the learner too, so it follows them to their other devices.
      getProfile().then((p) => { if (p && p.asr !== id) { p.asr = id; updateProfile(p); } });
      engineBtns.forEach((x, i) => x.setAttribute('aria-pressed', String(engines[i][0] === id)));
      engineNote.textContent = noteFor(id);
      // Start the one-time download right away, with progress, so it's visible.
      if (id === 'local' && !localAsrDownloaded()) {
        engineNote.textContent = 'מוריד את מנוע התמלול... 0%';
        loadLocalAsr((f) => { engineNote.textContent = `מוריד את מנוע התמלול... ${Math.round(f * 100)}%`; })
          .then(() => { engineNote.textContent = 'הורד והותקן. עובד גם בלי אינטרנט. אפשר ללחוץ "בדיקת תמלול".'; })
          .catch(() => { engineNote.textContent = 'ההורדה נכשלה. בדקו את החיבור לאינטרנט ונסו שוב.'; });
      }
    });
    return b;
  });
  engineNote.textContent = noteFor(asrEngine());

  return section('🎤 מיקרופון',
    el('div', { class: 'row-btns' }, testMic, testRec), meter, status, heard,
    el('div', { class: 'setting-row' }, el('span', {}, el('span', { class: 'setting-label' }, 'מנוע תמלול'), engineNote), el('div', { class: 'seg' }, engineBtns)),
    toggle('תרגילי דיבור', 'כשכבוי, תרגילי "קראו בקול" מדולגים', 'speaking'));
}

// A switch saved on the learner's profile, so it follows them to every device.
function profileToggle(profile, key, label, hint) {
  const box = el('input', { type: 'checkbox', checked: !!profile[key] });
  box.addEventListener('change', async () => { profile[key] = box.checked; await updateProfile(profile); });
  return el('label', { class: 'setting-row' },
    el('span', {}, el('span', { class: 'setting-label' }, label), el('span', { class: 'muted setting-hint' }, hint)),
    box);
}

export async function renderSettings(root, nav) {
  const profile = await getProfile();
  const account = profile
    ? section('👤 לומד',
      el('p', {}, 'לומד עכשיו: ', profile.avatar, ' ', profile.name),
      profileToggle(profile, 'starter', 'מסלול ABC למתחילים מאפס', 'אותיות, צלילים ומילים ראשונות לפני השיעור הראשון'),
      profileToggle(profile, 'voice_typing', 'הקלטה במקום הקלדה', 'בתרגילי כתיבה באנגלית יש כפתור מיקרופון שכותב את מה שאמרתם'),
      el('div', { class: 'row-btns' },
        el('button', { class: 'btn', type: 'button', onclick: () => { setCurrentProfile(null); nav('profiles'); } }, '🚪 החלפת לומד'),
        el('button', { class: 'btn', type: 'button', onclick: () => nav('placement') }, '🎯 מבחן רמה')))
    : null;
  root.replaceChildren(el('div', { class: 'screen settings' },
    el('h1', {}, '⚙️ הגדרות'),
    speakerSection(),
    micSection(),
    account,
    section('📦 עוד',
      el('div', { class: 'row-btns' },
        el('button', { class: 'btn', type: 'button', onclick: () => nav('reports') }, '📊 דוחות התקדמות'),
        el('button', { class: 'btn', type: 'button', onclick: () => nav('sync') }, '🔄 סנכרון בין מכשירים')),
      el('p', { class: 'muted' }, `גרסה ${APP_VERSION}`), updateCheck())));
}

// Asks the server for the latest version, past the app's own cache. When a newer
// one exists, drops the cached app files (never the learners' data) and reloads.
function updateCheck() {
  const status = el('p', { class: 'muted', 'aria-live': 'polite' });
  const btn = el('button', { class: 'btn', type: 'button' }, '⬇️ בדיקת עדכונים');
  btn.addEventListener('click', async () => {
    status.textContent = 'בודק...';
    try {
      const text = await (await fetch(`js/version.js?check=${Date.now()}`, { cache: 'no-store' })).text();
      const latest = text.match(/APP_VERSION = '(\d+)'/)?.[1];
      if (!latest) throw new Error('no version');
      if (Number(latest) <= Number(APP_VERSION)) { status.textContent = 'יש לך את הגרסה האחרונה.'; return; }
      status.textContent = `מעדכן לגרסה ${latest}...`;
      for (const r of await navigator.serviceWorker?.getRegistrations?.() || []) await r.unregister();
      for (const n of await caches.keys()) if (n.startsWith('english-app-')) await caches.delete(n);
      location.reload();
    } catch {
      status.textContent = 'לא הצלחתי לבדוק. בדקו את החיבור לאינטרנט.';
    }
  });
  return el('div', {}, btn, status);
}
