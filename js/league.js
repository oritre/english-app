// Weekly leagues. Pure logic: no DOM, no storage, `now` is injectable so the
// whole thing runs under node tests.
//
// A league is one week (Sunday 00:00 to Saturday 23:59, local time) in one tier.
// Real learners on this device who earned XP that week are placed with the
// others in their tier; simulated learners fill the rest. A simulated learner's
// XP is derived from a seed and the clock, so every reload shows the same
// board and their points keep climbing through the week.

import { localISO, addDays } from './dates.js';

export const TIERS = [
  { id: 0, name: 'ארד', icon: '🥉', color: '#b26d36' },
  { id: 1, name: 'כסף', icon: '🥈', color: '#8a94a6' },
  { id: 2, name: 'זהב', icon: '🥇', color: '#d39b00' },
  { id: 3, name: 'ספיר', icon: '💎', color: '#2d6fd6' },
  { id: 4, name: 'יהלום', icon: '👑', color: '#8b4fd1' },
];
export const LEAGUE_SIZE = 15;
export const PROMOTE = 3;
export const DEMOTE = 3;

const NAMES = [
  'נועם', 'תמר', 'איתי', 'מאיה', 'יואב', 'שירה', 'עומר', 'רוני', 'אלון', 'הילה', 'דניאל', 'יעל', 'אריאל', 'ליאור',
  'גיל', 'מיכל', 'עידו', 'נטע', 'אביב', 'שקד', 'רועי', 'ענבר', 'אורי ב.', 'ליה', 'עמית', 'טל', 'יונתן', 'אדל',
  'בן', 'נוגה', 'אסף', 'הדר', 'Lior K', 'Noa_22', 'Eitan', 'Sapir', 'Gal.M', 'Yarden', 'Dana R', 'Omer88',
  'סבתא רחל', 'משה', 'אביגיל', 'אליה', 'שחר', 'מור', 'רז', 'עדי', 'Tomer', 'Shani',
];
const AVATARS = ['🦊', '🐼', '🦁', '🐸', '🐙', '🦉', '🐬', '🐢', '🚀', '⚽', '🎸', '🌻', '🐱', '🐶', '🦄', '🐝', '🍕', '🎧', '🌈', '🐧'];

// ---- seeded randomness ----
function hash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
export function rng(seed) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r, lo, hi) => lo + r() * (hi - lo);
const intBetween = (r, lo, hi) => Math.floor(between(r, lo, hi + 1));

// ---- weeks ----
export function weekStart(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return localISO(d);
}
function dateAt(iso, hours) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime() + hours * 3600e3;
}
export function weekEnd(weekId) { return dateAt(addDays(weekId, 7), 0); }

// ---- simulated learners ----
// Each one gets a habit: how often they show up, when in the day, how many
// lessons per visit. Higher tiers are busier, like real leagues.
export function simulatedLearner(weekId, tier, index) {
  const r = rng(`${weekId}|${tier}|${index}`);
  const kindRoll = r();
  const kind = kindRoll < 0.35 ? 'casual' : kindRoll < 0.85 ? 'regular' : 'grinder';
  const habit = {
    casual: { pDay: [0.2, 0.5], sessions: [1, 2] },
    regular: { pDay: [0.5, 0.85], sessions: [1, 3] },
    grinder: { pDay: [0.85, 1], sessions: [2, 6] },
  }[kind];
  const tierBoost = 1 + tier * 0.3;
  const pDay = Math.min(1, between(r, ...habit.pDay) + tier * 0.04);
  const prefHour = [7.5, 13, 16.5, 20.5, 22][intBetween(r, 0, 4)];
  const joinDay = r() < 0.25 ? intBetween(r, 1, 3) : 0;
  const name = NAMES[Math.floor(r() * NAMES.length)];
  const avatar = AVATARS[Math.floor(r() * AVATARS.length)];

  const sessions = [];
  for (let day = joinDay; day < 7; day++) {
    if (r() > pDay) continue;
    const count = Math.max(1, Math.round(intBetween(r, ...habit.sessions) * between(r, 0.7, tierBoost)));
    let hour = Math.min(23.5, Math.max(6, prefHour + between(r, -1.5, 1.5)));
    for (let s = 0; s < count && hour < 24; s++) {
      const xp = r() < 0.7 ? intBetween(r, 14, 19) : intBetween(r, 10, 13);
      sessions.push({ at: dateAt(addDays(weekId, day), hour), xp });
      hour += between(r, 0.15, 0.7);
      if (r() < 0.2) hour += between(r, 3, 6); // came back later in the day
    }
  }
  return { id: `sim-${weekId}-${tier}-${index}`, name, avatar, simulated: true, sessions };
}

export function simulatedXp(learner, nowMs) {
  let xp = 0;
  for (const s of learner.sessions) if (s.at <= nowMs) xp += s.xp;
  return xp;
}

// ---- the board ----
// real: [{ id, name, avatar, xp }] already filtered to this tier and week.
export function buildBoard(weekId, tier, real, nowMs) {
  const usedNames = new Set(real.map((p) => p.name));
  const sims = [];
  for (let i = 0; sims.length < Math.max(0, LEAGUE_SIZE - real.length); i++) {
    const s = simulatedLearner(weekId, tier, i);
    if (usedNames.has(s.name)) continue;
    usedNames.add(s.name);
    sims.push(s);
  }
  const rows = [
    ...real.map((p) => ({ ...p, simulated: false })),
    ...sims.map((s) => ({ id: s.id, name: s.name, avatar: s.avatar, simulated: true, xp: simulatedXp(s, nowMs) })),
  ];
  // Ties go to real learners, then by name, so the order is stable.
  rows.sort((a, b) => b.xp - a.xp || (a.simulated - b.simulated) || a.name.localeCompare(b.name));
  return rows.map((row, i) => ({ ...row, rank: i + 1, zone: zoneFor(i + 1, tier, rows.length) }));
}

export function zoneFor(rank, tier, size = LEAGUE_SIZE) {
  if (rank <= PROMOTE && tier < TIERS.length - 1) return 'up';
  if (rank > size - DEMOTE && tier > 0) return 'down';
  return 'stay';
}

export function nextTier(tier, zone) {
  if (zone === 'up') return Math.min(TIERS.length - 1, tier + 1);
  if (zone === 'down') return Math.max(0, tier - 1);
  return tier;
}
