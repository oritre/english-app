# Recon map: Duolingo (mobile web / PWA)

Scope: the core learning loop only (path, lesson, exercises, XP, streak, review). No social, no monetization.
For: personal use, Hebrew speakers learning English (kids and adults).
Date: 2026-10-12

Note: written from public knowledge of Duolingo (help center, App Store listing, public walkthroughs). Not yet checked click by click against a live account. If you have a Duolingo account, walking through it once will sharpen the screen states.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | help center | https://support.duolingo.com | streaks, hearts, XP, path |
| 2 | App Store listing | https://apps.apple.com/app/duolingo/id570060128 | key screens |
| 3 | marketing site | https://www.duolingo.com | positioning: "free, fun, effective" |
| 4 | reading-practice-app (own) | https://github.com/oritre/reading-practice-app | reusable infra: PWA, IndexedDB, levels, glossary, vocab mastery |

## Core loop

Open the app, keep the streak alive by finishing one short lesson (3-5 minutes) of mixed exercises, earn XP, unlock the next lesson.

## Screens

| ID | screen | how to reach | purpose | key components | states |
| --- | --- | --- | --- | --- | --- |
| S01 | Welcome | first launch | start | logo, start button | - |
| S02 | Goal pick | onboarding | daily minutes 5/10/15/20 | option cards | selected |
| S03 | Level pick / placement | onboarding | beginner or test | option cards, test runner | in progress, result |
| S04 | Learning path (home) | default tab | see units and next lesson | top bar (streak, XP, hearts), unit header, lesson nodes | locked, current, done, unit complete |
| S05 | Lesson | tap current node | do 10-15 exercises | progress bar, exercise area, check button, quit | answering, correct, wrong, out of hearts |
| S06 | Lesson complete | end of lesson | reward | XP, accuracy, time, continue | perfect lesson |
| S07 | Streak screen | after first lesson of day / tap flame | celebrate, calendar | flame, week calendar | extended, frozen, lost |
| S08 | Practice hub | tab | review mistakes and weak words | cards | nothing to review |
| S09 | Words list | practice hub | vocab with strength | list, strength bars, speaker | empty |
| S10 | Profile / stats | tab | progress | XP chart, totals, achievements | - |
| S11 | Settings | profile | sound, hearts on/off, reminder time, backup | toggles | - |
| S12 | Stories | tab | read short stories with questions | story reader, glossary popover | reuse from reading-practice-app |

## Flows

```
F01 Do today's lesson (core)
    S04 -> S05 x12 exercises -> S06 -> S07 -> S04
    happy path taps: ~30 (2-3 per exercise)
    edge: quit mid-lesson, all hearts lost, app closed mid-lesson, offline
F02 First run
    S01 -> S02 -> S03 (beginner or placement) -> S05 first lesson -> S06 -> S04
F03 Review weak words
    S08 -> S05 (practice session built from mistakes) -> S06
F04 Missed a day
    open app -> streak freeze used or streak reset -> S07
```

## Exercise types (component inside S05)

| type | prompt | answer input | check |
| --- | --- | --- | --- |
| translate_he_en | Hebrew sentence (RTL) | word bank tiles or keyboard | normalized compare, alternatives list |
| translate_en_he | English sentence + speaker | word bank tiles | same |
| choose | "Which one is 'apple'?" | 3-4 cards with emoji | exact |
| match_pairs | 5 EN + 5 HE | tap pairs | per pair |
| fill_blank | sentence with gap | 3-4 options | exact |
| listen_type | speaker button (TTS) | keyboard | typo-tolerant |
| speak | sentence | microphone | speech recognition, lenient |

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Big button | primary, secondary, disabled | default, pressed, loading | all |
| Lesson node | locked, current, done | pulse on current | S04 |
| Word tile | bank, placed | default, selected, used | S05 |
| Feedback sheet | correct, wrong | slides up from bottom | S05 |
| Top stats bar | streak, XP, hearts | - | S04, S05 |
| Progress bar | lesson | animated | S05 |
| Speaker button | normal, slow | playing | S05, S09 |

## Inferred data model

```
Profile     id, name, daily_goal_xp, level, settings(json), created_at        confidence: high
Unit        id, order, title_he, title_en, cefr                                 confidence: high
Lesson      id, unit_id, order, title, exercise_ids[]                            confidence: high
Exercise    id, lesson_id, type, prompt, answer, alternatives[], options[], words[] confidence: high
LessonResult id, profile_id, lesson_id, date, xp, accuracy, duration, mistakes[]  confidence: high
DayLog      profile_id, date, xp, goal_met, freeze_used                          confidence: high (streak derived from it)
WordStat    profile_id, word, strength, last_seen, next_due, seen, correct       confidence: medium (spaced repetition)
```

Relationships: Unit 1-n Lesson 1-n Exercise; Profile 1-n LessonResult; Profile 1-n DayLog; Profile 1-n WordStat.

## Feature matrix

See `features.csv`. Must: 19, should: 10, could: 3, skip: 5.

## Out of scope

- Duolingo's course content and sentences (owned): we generate our own English course for Hebrew speakers with Claude, as JSON.
- Leagues, friends, leaderboards (need a network of users).
- Subscription, gems, ads.
- The owl, the name, the green brand: own name, own mascot.

## Size

Screens 12, flows 4, entities 7. Hard parts: (1) content volume and quality for a full A1-B1 course, (2) answer checking for free-text translations (alternatives, typos, Hebrew niqqud and RTL mixing), (3) speech recognition support differs by browser, iOS especially. Size: M for the engine (a few focused sessions), content grows unit by unit.

Next step: /replica-architect.
