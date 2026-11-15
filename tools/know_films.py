"""Animated general-knowledge films ("ידע כללי"), made here from scratch.

ori (2026-11-15): more general-knowledge courses, also on topics the approved
video channels don't cover: built from scratch, well animated, clear, fun and
serious, and above all true to a religious, conservative Jewish home. Nothing
progressive in any form.

A film lesson is the same storybook film as the weekly parasha
(js/exercises/parasha.js, exercise type 'parasha_film'): one painted picture per
scene, painted once by the home Pi (Gemini image, /img) from the course STYLE +
cast + the scene's prompt, a slow camera move, narration by the Pi's natural
voice, a "source" card (pasuk) and a "הידעת?" card (note). Then graded questions.

Levels (one script, up to three cuts; the app picks the cut by grade):
  1 = grades 1-3 (short sentences, ~3-5 min), 2 = grades 4-6 (~5-8 min),
  3 = grades 7-8 and adults (~8-12 min, more depth and sources).
A course lists the levels it serves; each lesson gives lines for those levels.

Content files: tools/know_films_*.py, each defining
  COURSES = [course(...), ...]
with course(id, area, icon, color, title_he, about_he, grades, levels, style, cast, units).
An existing course id (e.g. 'zionism', 'kings') adds film units to that topic;
a new id makes a new topic.
"""
import glob
import importlib
import os

LEVEL_GRADES = {1: [1, 3], 2: [4, 6], 3: [7, 13]}

BASE_STYLE = ('Painterly storybook illustration for a Jewish children\'s educational film: warm gouache and soft '
              'watercolor textures, cinematic wide 16:9 composition with depth, gentle light. Modest clothing for '
              'everyone: men in shirts with long trousers, women and girls in long skirts or dresses with sleeves to '
              'the elbow at least, married women with head coverings; religious men and boys wear a kippah where the '
              'scene is Jewish. Respectful, warm and child-friendly, no gore, no weapons pointed at people, no '
              'idols shown as objects of worship. No text, no letters, no logos, no frames. Never depict God.')


def S(sid, title_he, levels, img, cast=(), move='in', fx=None, art='', pasuk=None, note=None, say=None):
    """A scene. levels: which cuts include it. img: English picture prompt (what is seen, no text).
    say = {level: [lines]} (a level without lines uses the nearest lower one).
    pasuk = (text, source) for a verse/quote card; note = (who, text, levels) for a 'הידעת?' card.
    move: in|out|left|right|up. fx: stars|night|light|dust|mist|sparkle|sunset|None. art: fallback backdrop, up to 4 emoji
    (people 🚶👨👴👧👩👵👶👦, ⛺ 🏠 🪨 🐑 🐐, or a single animal/plant/🕊️/⛵) drawn until the picture arrives."""
    return {'id': sid, 'title_he': title_he, 'levels': list(levels), 'img': img, 'cast': list(cast), 'move': move,
            'fx': fx, 'art': art, 'pasuk': pasuk, 'note': note, 'say': say or {}}


def Q(levels, prompt_he, answer, wrong, explain_he):
    return {'levels': list(levels), 'q': {'type': 'mcq', 'prompt_he': prompt_he, 'answer': answer,
                                          'options': [answer, *wrong], 'explain_he': explain_he}}


def L(lesson_id, title_he, about_he, scenes, questions):
    return {'id': lesson_id, 'title_he': title_he, 'about_he': about_he, 'scenes': scenes, 'questions': questions}


def U(unit_id, title_he, about_he, *lessons):
    return {'id': unit_id, 'title_he': title_he, 'about_he': about_he, 'lessons': list(lessons)}


def course(cid, area, icon, color, title_he, about_he, grades, levels, style, cast, units):
    return {'id': cid, 'area': area, 'icon': icon, 'color': color, 'title_he': title_he, 'about_he': about_he,
            'grades': grades, 'levels': list(levels), 'style': style, 'cast': cast, 'units': units}


def _spaced(art):
    """'👴👨👨' -> '👴 👨 👨': the app's fallback (js/parashaLogic.js artPlan) reads emoji split by spaces."""
    out, join = [], False
    for ch in str(art or ''):
        if ch.isspace():
            join = False
            out.append(' ')
            continue
        glue = ch in '\ufe0f\u20e3\u200d' or 0x1F3FB <= ord(ch) <= 0x1F3FF or ch == '~'
        if out and out[-1] != ' ' and not glue and not join:
            out.append(' ')
        out.append(ch)
        join = ch == '\u200d' or ch == '~'
    return ' '.join(''.join(out).split())


def _prompt(c, sc):
    cast = ' '.join(c['cast'][x] for x in sc['cast'])
    return f"{BASE_STYLE} {c['style']} {cast} Scene: {sc['img']}".strip()


def _lines(sc, level):
    for lv in range(level, 0, -1):
        if sc['say'].get(lv) or sc['say'].get(str(lv)):
            return sc['say'].get(lv) or sc['say'].get(str(lv))
    return []


def _film(c, les, level):
    scenes = []
    for sc in les['scenes']:
        if level not in sc['levels']:
            continue
        note = sc['note']
        scenes.append({
            'id': sc['id'], 'title_he': sc['title_he'], 'img': _prompt(c, sc), 'move': sc['move'], 'fx': sc['fx'],
            'art': _spaced(sc['art']), 'say': _lines(sc, level),
            'pasuk': {'text': sc['pasuk'][0], 'ref': sc['pasuk'][1]} if sc['pasuk'] else None,
            'note': {'who': note[0], 'text': note[1]} if note and level in note[2] else None,
        })
    return {'type': 'parasha_film', 'kicker_he': f"{c['icon']} ידע כללי", 'title_he': les['title_he'], 'ref_he': c['title_he'], 'level': level,
            'grades': LEVEL_GRADES[level], 'scenes': scenes}


def check(c):
    ids = set()
    for u in c['units']:
        assert u['id'].startswith('k-'), u['id']
        for les in u['lessons']:
            assert les['id'].startswith('k-') and les['id'] not in ids, les['id']
            ids.add(les['id'])
            for lv in c['levels']:
                f = _film(c, les, lv)
                assert len(f['scenes']) >= 4, (les['id'], lv, 'needs at least 4 scenes')
                n = sum(lv in q['levels'] for q in les['questions'])
                assert n >= 3, (les['id'], lv, f'needs 3+ questions, has {n}')
            for sc in les['scenes']:
                assert set(sc['levels']) <= set(c['levels']), (les['id'], sc['id'], 'level outside the course')
                assert all(x in c['cast'] for x in sc['cast']), (les['id'], sc['id'], 'unknown cast')
                assert len(_prompt(c, sc)) <= 1800, (les['id'], sc['id'], len(_prompt(c, sc)))
                for lv in sc['levels']:
                    assert _lines(sc, lv), (les['id'], sc['id'], lv, 'no narration')
                for lines in sc['say'].values():
                    for line in lines:
                        assert 0 < len(line) <= 400, (les['id'], sc['id'], line[:40])
            for q in les['questions']:
                assert q['q']['answer'] in q['q']['options'] and len(set(q['q']['options'])) == len(q['q']['options']), (les['id'], q['q']['prompt_he'])
                assert set(q['levels']) <= set(c['levels']), (les['id'], q['q']['prompt_he'])
                assert q['q']['explain_he'], (les['id'], q['q']['prompt_he'])
    return ids


def lesson_exercises(c, les):
    ex = [_film(c, les, lv) for lv in c['levels']]
    for q in les['questions']:
        for lv in q['levels']:
            ex.append({**q['q'], 'grades': LEVEL_GRADES[lv]})
    return ex


def load():
    """All film courses from tools/know_films_*.py, in file order."""
    here = os.path.dirname(__file__)
    out = []
    strict = os.environ.get('KNOW_FILMS_STRICT') == '1'
    for path in sorted(glob.glob(os.path.join(here, 'know_films_*.py'))):
        name = os.path.basename(path)[:-3]
        try:
            mod = importlib.import_module(name)
            for c in mod.COURSES:
                check(c)
                out.append(c)
        except Exception as e:  # a file still being written must not stop the others
            if strict:
                raise
            import sys
            print(f'WARNING: skipped {name}: {type(e).__name__}: {e}', file=sys.stderr)
    return out


def minutes(c, les, level):
    words = sum(len(line.split()) for s in _film(c, les, level)['scenes'] for line in s['say'])
    return words / 120
