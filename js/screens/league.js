import { el } from '../util.js';
import { leagueView, markResultSeen } from '../progress.js';
import { TIERS, weekEnd, PROMOTE, DEMOTE } from '../league.js';

function timeLeft(weekId) {
  const ms = weekEnd(weekId) - Date.now();
  const days = Math.floor(ms / 86400e3);
  const hours = Math.floor((ms % 86400e3) / 3600e3);
  return days > 0 ? `${days} ימים ו־${hours} שעות` : `${hours} שעות`;
}

export async function renderLeague(root, nav) {
  const v = await leagueView();
  const { tier, board, myRow, lastResult } = v;

  const banner = lastResult && !lastResult.seen ? (() => {
    const t = TIERS[lastResult.tier];
    const msg = lastResult.zone === 'up' ? `סיימת במקום ${lastResult.rank} ועלית לליגת ${tier.name}! 🎉`
      : lastResult.zone === 'down' ? `סיימת במקום ${lastResult.rank} בליגת ${t.name} וירדת לליגת ${tier.name}. השבוע מתחילים מחדש.`
      : `סיימת במקום ${lastResult.rank} ונשארת בליגת ${tier.name}.`;
    markResultSeen();
    return el('div', { class: `league-banner ${lastResult.zone}` }, msg);
  })() : null;

  const rows = board.map((r) => {
    const me = myRow && r.id === myRow.id;
    const row = el('li', { class: `league-row ${r.zone} ${me ? 'me' : ''} ${r.simulated ? '' : 'real'}` },
      el('span', { class: 'rank' }, r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank),
      el('span', { class: 'avatar sm' }, r.avatar),
      el('span', { class: 'lname' }, r.name),
      el('span', { class: 'lxp', dir: 'ltr' }, `${r.xp} XP`));
    return row;
  });
  // Divider lines between the zones, like the promotion and demotion lines in real leagues.
  const items = [];
  rows.forEach((row, i) => {
    items.push(row);
    const rank = i + 1;
    if (rank === PROMOTE && tier.id < TIERS.length - 1) items.push(el('li', { class: 'zone-line up' }, '▲ אזור עלייה'));
    if (rank === board.length - DEMOTE && tier.id > 0) items.push(el('li', { class: 'zone-line down' }, '▼ אזור ירידה'));
  });

  root.replaceChildren(el('div', { class: 'screen league' },
    el('div', { class: 'form-top' },
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'חזרה', onclick: () => nav('path') }, '→'),
      el('h1', {}, `ליגת ${tier.name}`)),
    el('div', { class: 'tier-strip' }, TIERS.map((t) =>
      el('span', { class: `tier ${t.id === tier.id ? 'current' : t.id < tier.id ? 'past' : ''}`, title: t.name, style: `--tier: ${t.color}` }, t.icon))),
    el('p', { class: 'muted league-sub' }, `${PROMOTE} הראשונים עולים ליגה. הליגה נסגרת בעוד ${timeLeft(v.week)}.`),
    banner,
    myRow ? null : el('div', { class: 'league-join' }, 'סיימו שיעור השבוע כדי להיכנס לטבלה.',
      el('button', { class: 'btn primary', type: 'button', onclick: () => nav('path') }, 'לשיעור')),
    el('ol', { class: 'league-list' }, items)));
  const mine = root.querySelector('.league-row.me');
  if (mine) mine.scrollIntoView({ block: 'center' });
}
