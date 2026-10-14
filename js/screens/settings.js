import { el, en } from '../util.js';
import { speak, canSpeak, canSpeakLang, voiceName } from '../speech.js';
import { getSettings, setSetting } from '../settings.js';
import { measureMic, micMeter, HEARD_LEVEL, MIC_OK_TIP, MIC_SILENT_TIP, micErrorTip } from '../micTest.js';
import { Recognition } from '../exercises/speak.js';
import { getProfile, setCurrentProfile } from '../progress.js';

export const APP_VERSION = '15';

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
  testRec.addEventListener('click', () => {
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

  return section('🎤 מיקרופון',
    el('div', { class: 'row-btns' }, testMic, testRec), meter, status, heard,
    toggle('תרגילי דיבור', 'כשכבוי, תרגילי "קראו בקול" מדולגים', 'speaking'));
}

export async function renderSettings(root, nav) {
  const profile = await getProfile();
  const account = profile
    ? section('👤 לומד',
      el('p', {}, 'לומד עכשיו: ', profile.avatar, ' ', profile.name),
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
      el('p', { class: 'muted' }, `גרסה ${APP_VERSION}`))));
}
