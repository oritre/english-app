import { el } from '../util.js';
import { store } from '../db.js';
import { getFamilyCode, setFamilyCode, newFamilyCode, normalizeCode, syncConfigured, pullAll, pushAll } from '../sync.js';
import { rebuildDays } from '../progress.js';

export async function renderSync(root, nav) {
  const configured = await syncConfigured();
  const code = getFamilyCode();
  const status = el('p', { class: 'muted sync-status', 'aria-live': 'polite' });
  const back = el('div', { class: 'form-top' },
    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'חזרה', onclick: () => nav('back') }, '→'),
    el('h1', {}, 'סנכרון בין מכשירים'));

  const run = async (label, fn) => {
    status.textContent = label;
    try { await fn(); } catch (e) { console.warn(e); status.textContent = 'הסנכרון נכשל. בדקו את החיבור לאינטרנט ונסו שוב.'; return false; }
    return true;
  };

  if (!configured) {
    root.replaceChildren(el('div', { class: 'screen form' }, back,
      el('div', { class: 'card' },
        el('p', {}, 'הסנכרון עוד לא הופעל באפליקציה הזו. כרגע ההתקדמות נשמרת רק במכשיר הזה.'),
        el('p', { class: 'muted' }, 'מי שמנהל את האפליקציה צריך לחבר אותה ל־Firebase פעם אחת (ההוראות ב־README של הפרויקט). אחרי זה יופיע כאן קוד משפחה.'))));
    return;
  }

  if (!code) {
    const input = el('input', { id: 'family-code', class: 'text-input code-input', type: 'text', dir: 'ltr', maxlength: 12, autocomplete: 'off', placeholder: 'XXXXXXXX' });
    const join = el('button', { class: 'btn primary wide', type: 'button' }, 'חיבור עם קוד קיים');
    join.addEventListener('click', async () => {
      const c = normalizeCode(input.value);
      if (c.length !== 8) { status.textContent = 'הקוד צריך להיות 8 תווים.'; return; }
      setFamilyCode(c);
      const ok = await run('מוריד את הלומדים מהמכשירים האחרים...', async () => {
        const n = await pullAll(store);
        await rebuildDays();
        await pushAll(store);
        status.textContent = `מחובר. ${n} רשומות הגיעו מהמכשירים האחרים.`;
      });
      if (ok) setTimeout(() => nav('sync'), 1200); else setFamilyCode(null);
    });
    const create = el('button', { class: 'btn wide', type: 'button' }, 'יצירת קוד משפחה חדש');
    create.addEventListener('click', async () => {
      setFamilyCode(newFamilyCode());
      if (await run('מעלה את הלומדים של המכשיר הזה...', () => pushAll(store))) nav('sync');
    });
    root.replaceChildren(el('div', { class: 'screen form' }, back,
      el('p', {}, 'עם קוד משפחה, אותם לומדים וההתקדמות שלהם מופיעים בכל מכשיר: בטלפון, בטאבלט ובמחשב. גם הליגה והדוחות כוללים את כולם.'),
      el('label', { class: 'field-label', for: 'family-code' }, 'יש לכם כבר קוד ממכשיר אחר?'), input, join,
      el('div', { class: 'or' }, 'או'), create, status));
    return;
  }

  const copy = el('button', { class: 'btn', type: 'button' }, 'העתקה');
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(code); copy.textContent = 'הועתק ✔'; } catch { status.textContent = 'סמנו את הקוד והעתיקו ידנית.'; }
  });
  const now = el('button', { class: 'btn primary wide', type: 'button' }, 'סנכרון עכשיו');
  now.addEventListener('click', () => run('מסנכרן...', async () => {
    const n = await pullAll(store);
    await rebuildDays();
    await pushAll(store);
    status.textContent = n ? `עודכן. ${n} רשומות חדשות הגיעו.` : 'הכל מעודכן.';
  }));
  const leave = el('button', { class: 'btn ghost wide', type: 'button' }, 'ניתוק המכשיר הזה מהסנכרון');
  leave.addEventListener('click', () => { setFamilyCode(null); nav('sync'); });
  root.replaceChildren(el('div', { class: 'screen form' }, back,
    el('p', {}, 'המכשיר מסונכרן. כדי לחבר מכשיר נוסף, פתחו בו את האפליקציה, היכנסו למסך הזה והקלידו את הקוד:'),
    el('div', { class: 'code-box' }, el('span', { class: 'code', dir: 'ltr' }, code.replace(/(.{4})/, '$1 ')), copy),
    el('p', { class: 'muted small' }, 'כל מי שיש לו את הקוד רואה ומשנה את ההתקדמות של כל הלומדים. שתפו אותו רק עם המשפחה.'),
    now, leave, status));
}

// Called once at startup: brings in what other devices did since last time.
export async function syncOnLoad() {
  if (!getFamilyCode()) return;
  const timeout = new Promise((r) => setTimeout(r, 4000));
  await Promise.race([(async () => { if (await pullAll(store)) await rebuildDays(); })(), timeout])
    .catch((e) => console.warn('Sync on load failed', e));
}
