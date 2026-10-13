import { el } from '../util.js';
import { listProfiles, setCurrentProfile } from '../progress.js';

export const AVATARS = ['🦊', '🐼', '🦁', '🐸', '🐙', '🦉', '🐬', '🐢', '🚀', '⚽', '🎸', '🌻'];
export const GOALS = [
  { xp: 10, label: 'רגוע', note: 'שיעור אחד ביום' },
  { xp: 20, label: 'רגיל', note: 'שני שיעורים ביום' },
  { xp: 40, label: 'רציני', note: 'ארבעה שיעורים ביום' },
];

export async function renderProfiles(root, nav) {
  const profiles = await listProfiles();
  if (profiles.length === 0) return nav('profileCreate', { first: true });
  const cards = profiles.map((p) => el('button', {
    class: 'profile-card', type: 'button',
    onclick: () => { setCurrentProfile(p.id); nav(p.start_choice ? 'path' : 'startChoice'); },
  }, el('span', { class: 'avatar' }, p.avatar), el('span', { class: 'profile-name' }, p.name)));
  root.replaceChildren(el('div', { class: 'screen profiles' },
    el('h1', {}, 'מי לומד עכשיו?'),
    el('div', { class: 'profile-grid' }, cards,
      el('button', { class: 'profile-card add', type: 'button', onclick: () => nav('profileCreate') },
        el('span', { class: 'avatar' }, '+'), el('span', { class: 'profile-name' }, 'לומד חדש'))),
    el('button', { class: 'retest', type: 'button', onclick: () => nav('reports') }, '📊 דוחות התקדמות'),
    el('button', { class: 'retest', type: 'button', onclick: () => nav('sync') }, '🔄 סנכרון בין מכשירים')));
}

export function renderProfileCreate(root, nav, { first } = {}) {
  let avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  let goal = GOALS[0].xp;
  const name = el('input', { id: 'profile-name', class: 'text-input', type: 'text', maxlength: 20, autocomplete: 'off', placeholder: 'השם שלך' });
  const save = el('button', { class: 'btn primary wide', type: 'button', disabled: true }, 'יצירה');
  name.addEventListener('input', () => { save.disabled = name.value.trim() === ''; });

  const avatarBtns = AVATARS.map((a) => {
    const b = el('button', { class: `avatar-pick ${a === avatar ? 'selected' : ''}`, type: 'button', 'aria-label': a }, a);
    b.addEventListener('click', () => { avatar = a; avatarBtns.forEach((x) => x.classList.toggle('selected', x === b)); });
    return b;
  });
  const goalBtns = GOALS.map((g) => {
    const b = el('button', { class: `goal-pick ${g.xp === goal ? 'selected' : ''}`, type: 'button' },
      el('strong', {}, g.label), el('span', {}, g.note));
    b.addEventListener('click', () => { goal = g.xp; goalBtns.forEach((x) => x.classList.toggle('selected', x === b)); });
    return b;
  });

  save.addEventListener('click', async () => {
    const { createProfile, setCurrentProfile } = await import('../progress.js');
    const p = await createProfile({ name: name.value.trim(), avatar, dailyGoalXp: goal });
    setCurrentProfile(p.id);
    nav('startChoice');
  });

  root.replaceChildren(el('div', { class: 'screen form' },
    first ? el('div', { class: 'welcome' }, el('div', { class: 'celebrate' }, '👋'),
      el('h1', {}, 'ברוכים הבאים!'), el('p', { class: 'muted' }, 'שיעורי אנגלית קצרים, כמה דקות ביום.'))
      : el('div', { class: 'form-top' },
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'חזרה', onclick: () => nav('profiles') }, '→'),
        el('h1', {}, 'לומד חדש')),
    el('label', { for: 'profile-name', class: 'field-label' }, 'איך קוראים לך?'), name,
    el('div', { class: 'field-label' }, 'בחרו דמות'), el('div', { class: 'avatar-grid' }, avatarBtns),
    el('div', { class: 'field-label' }, 'יעד יומי'), el('div', { class: 'goal-grid' }, goalBtns),
    save,
    first ? el('button', { class: 'link-btn', type: 'button', onclick: () => nav('sync') }, 'כבר לומדים במכשיר אחר? חיבור עם קוד משפחה') : null));
  name.focus();
}

export async function renderStartChoice(root, nav) {
  const { getProfile, updateProfile } = await import('../progress.js');
  const p = await getProfile();
  const begin = async () => { p.start_choice = 'beginning'; await updateProfile(p); nav('path'); };
  root.replaceChildren(el('div', { class: 'screen start-choice' },
    el('div', { class: 'avatar big' }, p.avatar),
    el('h1', {}, `${p.name}, מאיפה מתחילים?`),
    el('button', { class: 'choice-big', type: 'button', onclick: begin },
      el('span', { class: 'emoji' }, '🌱'),
      el('strong', {}, 'מתחילים מההתחלה'),
      el('span', {}, 'אני חדש באנגלית, או רוצה לעבור על הכל מהבסיס')),
    el('button', { class: 'choice-big', type: 'button', onclick: () => nav('placement') },
      el('span', { class: 'emoji' }, '🎯'),
      el('strong', {}, 'מבחן רמה'),
      el('span', {}, 'כבר יודע קצת? כמה שאלות קצרות, ונקפוץ לשיעור שמתאים לך')),
    el('p', { class: 'muted small' }, 'אפשר לעשות את מבחן הרמה שוב בכל זמן מהמסך הראשי.')));
}
