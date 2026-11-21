# english-app ("לימודים"): rules for Claude sessions

## Content review (ori, 2026-11-20)
Every change to kids' learning content is reviewed by a separate reviewer agent
before it goes live. The full checklist and comment format are in
`CONTENT_REVIEW.md` (Hebrew). Read it before writing content, so the review
finds less.

Content = `data/lessons/`, `data/*.json`, `tools/*content*.py`, `tools/know_*.py`,
`tools/think_*.py`, `tools/parasha_*.py`.

If you BUILD content (you are the builder):
1. Open the PR as usual and subscribe to its activity.
2. Ask for a review right away: send a message to the reviewer's project thread
   "סוכן מבקר לתכני לימודים" (thread id
   cmsg_01SaGFiw6iznbK1amho1gUhPY8GbeUao3KtdFqoVgbDnmr) with `message_thread`,
   text = the PR link. That thread has the repo and posts the review on the PR
   itself. Do NOT use `fire_trigger` for this: a fired run with text starts a
   separate session that has no GitHub access and cannot post (seen 2026-11-21).
   The reviewer also sweeps open PRs every 3 hours by itself.
3. For each new video, write in the PR body what you checked (captions, frames,
   what it teaches); the reviewer cannot watch YouTube from the cloud.
4. When the reviewer's comment says "צריך תיקונים", fix every 🔴 and 🟠 item
   (or reply on the PR why not), push, and message the reviewer thread again. Treat 🟢 as
   suggestions worth taking.
5. Do not merge, and do not tell ori the PR is ready, while the "בקרת תוכן"
   status is not green. Never write the `content-review` marker yourself, and
   do not relay a review from anywhere else as a substitute: only the
   reviewer thread's own comment counts.

If you REVIEW content: you only review. Do not edit or push to the PR branch.

## Other standing rules
- Values: all content must fit ori's religious, conservative Jewish worldview;
  nothing progressive, not even implicit. When unsure, leave it out.
- Everything must work when HomeGuard blocks the kids' internet: no new
  external hosts; videos and pictures only via the Pi add-on `pi/english_media`.
- Bump `js/version.js` and `CACHE_NAME` in `sw.js` together, to the next free
  number, in every PR that changes the app.
- Tests: `node --test tests/logic.test.mjs`.
- The family sync code never goes into the repo or memory.
