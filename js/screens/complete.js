import { el } from '../util.js';

export async function renderComplete(root, nav, p) {
  const { leagueView } = await import('../progress.js');
  const league = await leagueView();
  const mins = Math.floor(p.durationS / 60);
  const secs = String(p.durationS % 60).padStart(2, '0');
  const streakUp = p.streakAfter > p.streakBefore;
  root.replaceChildren(el('div', { class: 'screen complete' },
    el('div', { class: 'celebrate' }, p.accuracy === 100 ? '🏆' : '🎉'),
    el('h1', {}, p.accuracy === 100 ? 'שיעור מושלם!' : 'סיימתם את השיעור!'),
    el('p', { class: 'muted' }, p.lessonTitle),
    el('div', { class: 'result-cards' },
      el('div', { class: 'result xp' }, el('div', { class: 'label' }, 'XP'), el('div', { class: 'value', dir: 'ltr' }, `+${p.xp}`)),
      el('div', { class: 'result acc' }, el('div', { class: 'label' }, 'דיוק'), el('div', { class: 'value' }, `${p.accuracy}%`)),
      el('div', { class: 'result time' }, el('div', { class: 'label' }, 'זמן'), el('div', { class: 'value', dir: 'ltr' }, `${mins}:${secs}`))),
    streakUp ? el('div', { class: 'streak-banner' }, `🔥 רצף של ${p.streakAfter} ${p.streakAfter === 1 ? 'יום' : 'ימים'}!`) : null,
    league.myRow ? el('button', { class: 'league-note', type: 'button', onclick: () => nav('league') },
      `${league.tier.icon} מקום ${league.myRow.rank} בליגת ${league.tier.name}`) : null,
    p.goalMetNow ? el('p', { class: 'goal-met' }, 'עמדתם ביעד היומי ✔') : null,
    el('button', { class: 'btn primary wide', type: 'button', onclick: () => nav('path') }, 'המשך')));
}
