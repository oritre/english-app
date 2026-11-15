// The 20-minute round on screen: a small strip with each subject's minutes, and
// the card that sends the learner on to the other subjects.
import { el } from '../util.js';
import { SUBJECTS } from '../insights.js';

const mins = (x) => Math.min(99, Math.floor(x));

export function roundStrip(round) {
  if (!round || round.need.length < 2) return null;
  return el('div', { class: 'round-strip', role: 'status', 'aria-label': 'סבב הלמידה של היום' },
    el('span', { class: 'round-strip-title' }, `⏱️ סבב של ${round.quota} דק'`),
    SUBJECTS.filter((s) => round.need.includes(s.id)).map((s) => {
      const full = round.used[s.id] >= round.quota;
      return el('span', { class: `round-chip${full ? ' full' : ''}`, title: s.name },
        s.icon, ' ', full ? '✓' : `${mins(round.used[s.id])}/${round.quota}`);
    }));
}

// `subject`: the subject that just closed. `go(id)` opens another subject.
export function roundCard(round, subject, go) {
  const s = SUBJECTS.find((x) => x.id === subject);
  const next = SUBJECTS.filter((x) => round.waiting.includes(x.id));
  return el('section', { class: 'round-card' },
    el('div', { class: 'round-card-icon', 'aria-hidden': 'true' }, '🔄'),
    el('h2', {}, `${round.quota} דקות של ${s?.name || ''}, כל הכבוד!`),
    el('p', {}, 'עכשיו ממשיכים לנושא אחר. ', s?.name || 'הנושא הזה', ` ייפתח שוב אחרי שתעשה ${round.quota} דקות גם ב${next.map((x) => x.name).join(' וב')}.`),
    el('div', { class: 'round-card-go' }, next.map((x) => el('button', { class: 'btn primary', type: 'button', onclick: () => go(x.id) },
      x.icon, ' ', x.name, ' · ', `עוד ${Math.max(1, Math.ceil(round.quota - round.used[x.id]))} דק'`))));
}
