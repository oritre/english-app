#!/usr/bin/env python3
"""Readable digest of the kid-facing content a change adds or edits.

The content reviewer (see CONTENT_REVIEW.md) reads this instead of the raw
diff: every new or changed lesson in data/lessons, exercise by exercise, with
the exact Hebrew/English text a child will see or hear, the grades each
question is shown to, film narration and picture prompts, and video sources.

Usage:
  python3 tools/review_digest.py                 # main...HEAD
  python3 tools/review_digest.py origin/main     # any base ref
  python3 tools/review_digest.py BASE HEAD -o review.md
  python3 tools/review_digest.py --files data/lessons/k-phy-f1.json   # whole lessons, no git

Changed lessons show only the exercises that are new or changed (an exercise
counts as changed when any of its fields differ). Removed lessons are listed.
"""
import argparse
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LESSONS = "data/lessons/"
CATALOGS = ["data/course.json", "data/think.json", "data/know.json",
            "data/parasha.json", "data/videos.json"]
SKIP_KEYS = {"id", "type", "img_hash", "hash", "art", "seed"}


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                          text=True, check=True).stdout


def load_at(ref, path):
    if ref is None:
        with open(os.path.join(ROOT, path), encoding="utf-8") as f:
            return json.load(f)
    try:
        return json.loads(git("show", f"{ref}:{path}"))
    except subprocess.CalledProcessError:
        return None


def grades(e):
    g = e.get("grades")
    if not g:
        return ""
    return f" _(כיתות {g[0]}–{g[-1]})_" if len(g) == 2 else f" _(כיתות {g})_"


def q(s):
    return str(s).replace("\n", " ").strip()


def render_value(k, v, out, ind):
    if v in (None, "", [], {}):
        return
    if isinstance(v, str):
        out.append(f"{ind}- **{k}:** {q(v)}")
    elif isinstance(v, (int, float, bool)):
        out.append(f"{ind}- {k}: {v}")
    elif isinstance(v, list) and all(isinstance(x, (str, int, float)) for x in v):
        out.append(f"{ind}- **{k}:** " + " | ".join(q(x) for x in v))
    else:
        out.append(f"{ind}- **{k}:** `{json.dumps(v, ensure_ascii=False)[:600]}`")


def render_film(e, out):
    out.append(f"- 🎞️ **סרט מונפש:** {q(e.get('title_he', ''))} · {q(e.get('ref_he', ''))}"
               f" · רמה {e.get('level', '?')}{grades(e)}")
    for s in e.get("scenes", []):
        out.append(f"  - **סצנה {s.get('id')}: {q(s.get('title_he', ''))}**")
        for line in s.get("say", []) or []:
            out.append(f"    - 🔊 {q(line)}")
        for ln in s.get("lines", []) or []:
            if isinstance(ln, (list, tuple)):
                out.append(f"    - 🗣️ {ln[0]}: {q(ln[1]) if len(ln) > 1 else ''}")
            else:
                out.append(f"    - 🗣️ {q(json.dumps(ln, ensure_ascii=False))}")
        if s.get("pasuk"):
            p = s["pasuk"]
            out.append(f"    - 📜 פסוק: {q(p.get('text', ''))} ({q(p.get('ref', ''))})")
        if s.get("note"):
            out.append(f"    - 📝 הערה: {q(s['note'])}")
        img = s.get("img") or ""
        if img:
            # The shared style preamble repeats in every scene; show the scene part.
            tail = img.split("Scene:", 1)[-1].strip() if "Scene:" in img else img
            out.append(f"    - 🖼️ תמונה: {q(tail)[:400]}")
        for k, v in s.items():
            if k not in {"id", "title_he", "say", "lines", "pasuk", "note", "img",
                         "move", "fx", "art"}:
                render_value(k, v, out, "    ")


def render_ex(e, out):
    t = e.get("type")
    if t == "parasha_film":
        render_film(e, out)
        return
    if t == "video":
        out.append(f"- 🎬 **סרטון:** {q(e.get('title_he', ''))} · {q(e.get('source_he', ''))}"
                   f" · {e.get('duration', '?')} שנ' · https://youtu.be/{e.get('youtube', '')}")
        return
    if t == "mcq":
        opts = e.get("options", [])
        ans = e.get("answer")
        def lab(o):
            return o.get("label") if isinstance(o, dict) else o

        def show(o):
            if isinstance(o, dict):
                return f"[איור {o.get('label')}]"
            return q(o)
        mark = " | ".join(("✅ " if lab(o) == ans else "") + show(o) for o in opts)
        out.append(f"- ❓ {q(e.get('prompt_he', ''))}{grades(e)}")
        out.append(f"  - {mark}")
        if ans not in [lab(o) for o in opts]:
            out.append(f"  - ⚠️ התשובה ({q(ans)}) לא נמצאת באפשרויות")
        for k in ("hint_he", "explain_he"):
            if e.get(k):
                out.append(f"  - {'רמז' if k == 'hint_he' else 'הסבר'}: {q(e[k])}")
        for k, v in e.items():
            if k not in SKIP_KEYS | {"prompt_he", "options", "answer", "hint_he",
                                     "explain_he", "grades"}:
                render_value(k, v, out, "  ")
        return
    head = e.get("title_he") or e.get("prompt_he") or e.get("prompt") or e.get("text") or ""
    out.append(f"- **[{t}]** {q(head)}{grades(e)}")
    for k, v in e.items():
        if k in SKIP_KEYS or k in ("title_he", "prompt_he", "grades"):
            continue
        render_value(k, v, out, "  ")


def lesson_block(path, old, new, out):
    lid = (new or old).get("id", os.path.basename(path))
    title = (new or old).get("title_he", "")
    course = (new or old).get("course", (new or old).get("unit_id", ""))
    if new is None:
        out.append(f"### ➖ הוסר: {lid} · {title}")
        return
    status = "חדש" if old is None else "שונה"
    out.append(f"### {'🆕' if old is None else '✏️'} {lid} · {title}  _(קורס {course}, {status})_")
    old_ex = {x.get("id"): x for x in (old or {}).get("exercises", [])}
    shown = 0
    for e in new.get("exercises", []):
        if old is not None and old_ex.get(e.get("id")) == e:
            continue
        if old is not None and e.get("id") in old_ex:
            out.append("- _(שונה)_")
        render_ex(e, out)
        shown += 1
    if old is not None:
        gone = set(old_ex) - {x.get("id") for x in new.get("exercises", [])}
        if gone:
            out.append(f"- ➖ תרגילים שהוסרו: {', '.join(sorted(map(str, gone)))}")
        if not shown and not gone:
            meta = {k for k in set(old) | set(new) if k != "exercises" and old.get(k) != new.get(k)}
            out.append(f"- שינוי בשדות השיעור בלבד: {', '.join(sorted(meta))}")
    out.append("")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", default="main")
    ap.add_argument("head", nargs="?", default="HEAD")
    ap.add_argument("--files", nargs="+", help="render these lesson files whole, no git")
    ap.add_argument("-o", "--out")
    a = ap.parse_args()

    out = []
    if a.files:
        out.append("# תוכן לבקרה (שיעורים מלאים)\n")
        for p in a.files:
            rel = os.path.relpath(os.path.abspath(p), ROOT)
            lesson_block(rel, None, load_at(None, rel), out)
    else:
        mb = git("merge-base", a.base, a.head).strip()
        names = git("diff", "--name-status", mb, a.head).splitlines()
        changed = []
        for row in names:
            parts = row.split("\t")
            changed.append((parts[0][0], parts[-1]))
        lessons = [(s, p) for s, p in changed if p.startswith(LESSONS) and p.endswith(".json")]
        other = [p for s, p in changed if not (p.startswith(LESSONS))]
        out.append(f"# תוכן לבקרה: {a.base}...{a.head}\n")
        out.append(f"{len(lessons)} שיעורים חדשים או שהשתנו.\n")
        cats = [p for p in other if p in CATALOGS]
        if cats:
            out.append("קטלוגים שהשתנו (לבדוק שמות קורסים, טווחי כיתות ותיאורים בדיף): "
                       + ", ".join(cats) + "\n")
        src = [p for p in other if p.startswith("tools/") or p.startswith("js/")]
        if src:
            out.append("קבצי קוד/מקור שהשתנו (טקסט שמופיע לילד יכול להיות גם כאן): "
                       + ", ".join(src) + "\n")
        for s, p in sorted(lessons, key=lambda x: x[1]):
            old = None if s == "A" else load_at(mb, p)
            new = None if s == "D" else load_at(a.head, p)
            lesson_block(p, old, new, out)

    text = "\n".join(out) + "\n"
    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"wrote {a.out} ({len(text)} chars)")
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
