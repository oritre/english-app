// Active learning time. A learning screen (lesson, practice, video, talk)
// opens a session; every few seconds it counts as active only while the page
// is visible and the learner touched or typed in the last IDLE_MS, or a video,
// read-aloud or conversation is playing. A screen left open on the table adds
// to open time but not to active time.
//
// Sessions are kept with the attempts (type 'session'), so they sync like the
// rest and need no new Firestore collection. A session is saved every minute
// and when the screen closes, so time spent in a lesson that was left halfway
// still counts.
import { store, newId } from './db.js';
import { localISO } from './dates.js';
import { currentProfileId } from './progress.js';
import { subjectOf } from './insights.js';

const TICK_MS = 5000;
export const IDLE_MS = 45000;
const SAVE_EVERY_MS = 60000;

let lastInput = Date.now();
for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel', 'input']) {
  window.addEventListener(ev, () => { lastInput = Date.now(); }, { capture: true, passive: true });
}

const mediaPlaying = () => [...document.querySelectorAll('video, audio')].some((m) => !m.paused && !m.ended)
  || ('speechSynthesis' in window && speechSynthesis.speaking);

let current = null;

// Starts counting for a learning screen; ends whichever session was open.
export function startSession(lessonId) {
  endSession();
  const profileId = currentProfileId();
  if (!profileId) return null;
  const now = Date.now();
  lastInput = now;
  const s = {
    rec: {
      id: newId(), profile_id: profileId, type: 'session', source: 'session', outcome: 'session',
      lesson_id: lessonId, exercise_id: `session-${lessonId}`, subject: subjectOf(lessonId),
      date: localISO(), at: now, hour: new Date().getHours(), end: now, active_s: 0, open_s: 0, finished: false,
    },
    activeMs: 0, openMs: 0, last: now, savedAt: now, hold: 0,
  };
  s.timer = setInterval(() => tick(s), TICK_MS);
  current = s;
  return s;
}

function tick(s, final = false) {
  const now = Date.now();
  const dt = Math.min(now - s.last, TICK_MS * 2);
  s.last = now;
  if (document.visibilityState === 'visible') {
    s.openMs += dt;
    if (now - lastInput < IDLE_MS || s.hold > 0 || mediaPlaying()) s.activeMs += dt;
  }
  if (final || now - s.savedAt >= SAVE_EVERY_MS) save(s);
}

function save(s) {
  s.savedAt = Date.now();
  Object.assign(s.rec, { end: s.savedAt, active_s: Math.round(s.activeMs / 1000), open_s: Math.round(s.openMs / 1000) });
  if (s.rec.open_s > 0) store.put('attempts', { ...s.rec }).catch(() => {});
}

// Keeps the session active without taps, e.g. while a spoken conversation runs.
export function holdActive(on) { if (current) current.hold = Math.max(0, current.hold + (on ? 1 : -1)); }

// The lesson reached its end screen.
export function markFinished() { if (current) current.rec.finished = true; }

export function endSession() {
  const s = current;
  if (!s) return;
  current = null;
  clearInterval(s.timer);
  tick(s, true);
}

// Hiding the app (switching apps, locking the phone) saves what was counted so far.
document.addEventListener('visibilitychange', () => {
  if (!current) return;
  if (document.visibilityState === 'hidden') { tick(current); save(current); } else current.last = Date.now();
});
window.addEventListener('pagehide', () => { if (current) { tick(current); save(current); } });
