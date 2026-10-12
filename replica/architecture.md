# Architecture: English for Hebrew speakers (a rebuild of Duolingo's core loop)

Working name until /replica-brand: "english-app".

## Stack

Same stack as oritre/reading-practice-app, because it already works on your devices and needs no server or bill.

| layer | choice | why |
| --- | --- | --- |
| web | Vanilla JS ES modules, no build step, PWA (manifest + service worker) | known stack, installs on the phone home screen, works offline |
| styling | One CSS file with design tokens as CSS variables, dir="rtl" shell | Hebrew UI; English content wrapped in dir="ltr" spans |
| database | IndexedDB (copy db.js pattern) | single user, local first |
| sync / backup | Optional Firebase Firestore mirror (copy sync.js) + JSON export (copy backup.js) | already built |
| auth | none (local profiles, copy profileSelect) | personal app |
| audio | Web Speech API: speechSynthesis (en-US) for listening, SpeechRecognition for speaking | free, no keys; speaking hidden where unsupported (iOS Safari) |
| content | Static JSON course files in data/course/, generated with Claude, reviewed by you | owned content, versioned in git |
| hosting | GitHub Pages | free, HTTPS (needed for PWA and microphone) |
| payments, email, jobs | none | personal app |

## Data

Content (read-only, from JSON, cached by the service worker):

```
course.json   { units: [ { id, order, cefr, title_he, title_en, lessons: [lessonId...] } ] }
lessons/<id>.json
  { id, unit_id, title_he, new_words: [ {en, he, emoji?} ],
    exercises: [
      { id, type: "translate_he_en", prompt: "יש לי כלב", answer: "I have a dog",
        alternatives: ["I've got a dog"], bank: ["I","have","a","dog","cat","is"] },
      { id, type: "translate_en_he", prompt: "The cat is small", answer: "החתול קטן",
        alternatives: ["החתול הוא קטן"], bank: [...] },
      { id, type: "choose", prompt_he: "איזה מהם 'apple'?", options: [ {en:"apple",emoji:"🍎"}, ... ], answer: "apple" },
      { id, type: "match_pairs", pairs: [ ["dog","כלב"], ... ] },
      { id, type: "fill_blank", sentence: "She ___ a teacher", options: ["is","are","am"], answer: "is" },
      { id, type: "listen_type", audio_text: "Good morning", answer: "Good morning" },
      { id, type: "speak", text: "Nice to meet you" } ] }
```

User state (IndexedDB stores, all keyed by profile_id):

| store | key | fields | index |
| --- | --- | --- | --- |
| profiles | id | name, daily_goal_xp, start_level, settings {sound, hearts_on, speak_on, reminder_time} | - |
| progress | [profile_id, lesson_id] | status (locked/current/done), best_accuracy, times_done | profile_id |
| results | id | profile_id, lesson_id, date, xp, accuracy, duration_s, mistakes [exercise_id] | profile_id, date |
| days | [profile_id, date] | xp, goal_met, freeze_used | profile_id |
| words | [profile_id, word] | strength 0-5, seen, correct, last_seen, next_due | profile_id, next_due |

Derived, never stored: streak (count back over `days` from today/yesterday), hearts (in-memory per lesson), unlocked lessons (from progress).

## Core modules

| module | does | flow |
| --- | --- | --- |
| course.js | loads course.json + lesson files, resolves unlock state | F01, F02 |
| lessonRunner.js | builds the session queue (lesson exercises, shuffled, mistakes re-queued at the end), hearts, progress bar | F01, F03 |
| exercises/*.js | one renderer per exercise type, same interface: render(root, ex, onAnswer) | F01 |
| check.js | answer normalization and comparison (see below) | F01 |
| streak.js | records XP for today, computes streak, applies freeze | F01, F04 |
| srs.js | updates word strength after each exercise, picks due words for practice | F03 |
| speech.js | speak(text, rate), listen() with feature detection | F01 |

## The parts that bite

- Answer checking: lower-case, strip punctuation and extra spaces, expand contractions (I'm = I am, don't = do not), accept listed alternatives, allow 1 typo per 8 letters for typed answers (Levenshtein) and say "almost right" when used. Hebrew: strip niqqud and normalize final letters before comparing.
- RTL/LTR mixing: every English string is rendered inside dir="ltr"; word bank tiles keep their own direction; punctuation at line ends tested on both.
- Dates and streaks: use the device's local date (not UTC) for "today", or a lesson at 01:00 counts for the wrong day.
- Speech: SpeechRecognition is missing on iOS Safari and Firefox; the speak exercise is skipped (not failed) there. speechSynthesis voices load async; pick an en-US voice after the voiceschanged event.
- Content quality: generated sentences need a native-level review pass; keep one JSON file per lesson so review is small.
- Service worker caching: version the cache name per release, or new lessons won't appear.

## Build order

1. Vertical slice: S04 path (one unit), S05 lesson with 3 exercise types (choose, translate_he_en with bank, match_pairs), check.js, S06 lesson complete with XP. Tables: profiles, progress, results, days. One unit of content (≈5 lessons, greetings and basic nouns).
2. Must-haves: remaining exercise types (translate_en_he, fill_blank, listen_type), mistakes re-queued, streak + S07, onboarding S01-S03 with placement test, PWA offline.
3. Should-haves: hearts (off by default, toggle in settings), speak exercise, practice hub S08 + words S09 + SRS, tap-word hints, streak freeze, reminders, stats S10, stories S12 ported from reading-practice-app, sync.
4. Content: Pre-A1 to A2 course, about 10 units x 5 lessons x 12 exercises, generated and reviewed unit by unit.
5. Could-haves and fixes from /replica-entrepreneur (users often complain about hearts and paywalled practice; ours keeps both free and optional).

Next step: /replica-design, then /replica-build for milestone 1.
