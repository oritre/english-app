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


def _repeats(lines):
    return [a for a, b in zip(lines, lines[1:]) if a.strip() == b.strip()]


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
                    assert not _repeats(_lines(sc, lv)), (les['id'], sc['id'], lv, 'a line said twice in a row')
                for lines in sc['say'].values():
                    for line in lines:
                        assert 0 < len(line) <= 400, (les['id'], sc['id'], line[:40])
            for q in les['questions']:
                assert q['q']['answer'] in q['q']['options'] and len(set(q['q']['options'])) == len(q['q']['options']), (les['id'], q['q']['prompt_he'])
                assert set(q['levels']) <= set(c['levels']), (les['id'], q['q']['prompt_he'])
                assert q['q']['explain_he'], (les['id'], q['q']['prompt_he'])
    return ids


# Background music under the narration (ori 2026-11-21: present the films like the
# Hidabroot Kids videos, which run a quiet music bed under the voice all along).
# The Pi makes each piece once (Lyria, /music) and the player loops it softly.
MUSIC = {
    'israel': 'Warm cinematic orchestral underscore for a Jewish children\'s history documentary: soft strings, '
              'gentle piano and a light hand drum, hopeful and noble, steady calm pace, no vocals, no choir, '
              'seamless loop.',
    'history': 'Cinematic documentary underscore for children: soft strings and harp, curious and calm, a sense '
               'of ancient times, steady gentle pace, no vocals, seamless loop.',
    'society': 'Light, friendly underscore for a children\'s explainer: soft marimba, pizzicato strings and '
               'acoustic guitar, cheerful and calm, no vocals, seamless loop.',
    'nature': 'Gentle wonder underscore for a children\'s nature film: soft piano, celesta and warm strings, '
              'curious and peaceful, no vocals, seamless loop.',
}


def _ordered(c):
    return [les for u in c['units'] for les in u['lessons']]


# How the host frames each film, decided per lesson by hand (the reviews of #45:
# word lists gave both misses and false alarms). Same at every level.
#   no_music     no music bed under any level of the lesson
#   quiet_start  no "שלום לכם" before the title
#   end=quiet    no words of ours after the last line
#   end=said     the last line already leads into the next part: nothing added
#   end=plain    "ובפרק הבא: X." without the cheerful "נתראה!"
# A lesson not listed: greeting, music, and "ובפרק הבא: X. נתראה!".
SOLEMN_COURSES = {'holocaust'}          # hushed all through: no greeting, no farewell, no music
NO_MUSIC_COURSES = {'holocaust', 'wars'}  # the fallen: no music under any film
FILM_MOOD = {
    # destruction of the Temples and the mourning for them
    'k-mik-f5': 'end=plain',
    'k-mik-f6': 'no_music quiet_start end=quiet',
    'k-mik-f7': 'no_music quiet_start',
    'k-jer-f2': 'end=plain',
    'k-jer-f3': 'no_music quiet_start end=plain',
    'k-jer-f6': 'no_music quiet_start end=quiet',
    'k-jer-f7': 'no_music',
    'k-kgf-f7': 'no_music quiet_start',
    'k-gre-f3': 'end=plain',
    'k-gre-f4': 'no_music quiet_start end=plain',
    'k-gre-f5': 'no_music quiet_start end=plain',
    # a journey whose last line already says where we go next
    'k-lnf-f2': 'end=said',
    'k-lnf-f3': 'end=said',
    'k-lnf-f4': 'end=said',
    # ends by pointing to another course, after hard times
    'k-sag-f4': 'end=plain',
    'k-sag-f5': 'end=plain',
    # martyrdom, expulsion, pogroms
    'k-sag-f2': 'no_music end=quiet',
    'k-exl-f1': 'no_music quiet_start end=quiet',
    'k-exl-f3': 'end=plain',
    'k-exl-f4': 'no_music quiet_start end=quiet',
    'k-exl-f5': 'no_music quiet_start end=quiet',
    'k-exl-f6': 'end=plain',
    'k-exl-f7': 'no_music quiet_start end=quiet',
    'k-zio-f7': 'no_music',
    'k-wof-f5': 'no_music',
    'k-itc-f5': 'no_music end=plain',
    # the fallen in Israel's wars (no music in the whole course)
    'k-war-f1': 'quiet_start end=quiet',
    'k-war-f2': 'end=plain',
    'k-war-f5': 'quiet_start end=quiet',
}
# Titles as the narrator should say them aloud (no niqqud, initials read wrong).
SPOKEN_TITLE = {
    'k-exf-f2': 'משה בתיבה, על שפת היאור',
    'k-zio-f2': 'תלמידי הבעל שם טוב ותלמידי הגאון מווילנה',
    'k-zio-f8': 'כ״ט בנובמבר ויום העצמאות',
}
# The last scene already says what comes next: then no second announcement.
NEXT_SAID = ('בפרק הבא', 'בשיעור הבא', 'בסרט הבא', 'בפרקים הבאים', 'בשיעורים הבאים', 'הפרק האחרון', 'השיעור האחרון',
             'הסרט האחרון', 'בפרק האחרון', 'בשיעור האחרון', 'הבא והאחרון', 'נתראה', 'להתראות', 'לילה טוב',
             'בפעם הבאה נ', 'עוד נכיר', 'עוד נלמד', 'עוד נראה', 'נגלה בקרוב', 'בהמשך נ', 'ועכשיו הגיע הזמן להכיר')
# The first lines already name the topic: then the greeting does not name it again.
INTRO_SAID = ('בפרק הזה', 'בשיעור הזה', 'בסרט הזה', 'היום נלמד', 'היום נכיר')
HELLO = ('שלום', 'בוקר טוב', 'ערב טוב', 'צהריים טובים', 'ברוכים הבאים')


def _has(lines, words):
    return any(w in line for line in lines for w in words)


def _title(les):
    """A lesson's title as the end of a spoken sentence: its own ? or ! stays,
    otherwise a full stop; a colon inside becomes a pause of its own."""
    t = SPOKEN_TITLE.get(les['id'], les['title_he'])
    t = str(t).strip().rstrip('.').strip().replace(': ', '. ')
    return t if t.endswith(('?', '!')) else f'{t}.'


def _mood(c, les):
    m = FILM_MOOD.get(les['id'], '').split()
    end = next((w[4:] for w in m if w.startswith('end=')), None)
    solemn = c['id'] in SOLEMN_COURSES
    return {'solemn': solemn,
            'quiet_start': solemn or 'quiet_start' in m,
            'end': 'quiet' if solemn else end,
            'music': not (c['id'] in NO_MUSIC_COURSES or 'no_music' in m)}


def _framed(c, les, film, mood):
    """The host's words around the film, as in the Hidabroot videos: a greeting
    before the first scene and, after the last, what the next part is about."""
    order = _ordered(c)
    k = next(i for i, x in enumerate(order) if x['id'] == les['id'])
    first, last = film['scenes'][0], film['scenes'][-1]
    if k + 1 < len(order):
        film['next_he'] = order[k + 1]['title_he']
    film['quiet_end'] = mood['end'] == 'quiet'
    film['music'] = (c.get('music') or MUSIC.get(c['area'], MUSIC['history'])) if mood['music'] else None
    if mood['solemn']:
        return film
    if not first['say'][0].lstrip().startswith(HELLO):
        hello = 'שלום לכם!' if film['level'] == 3 else 'שלום לכם, ילדים!'
        opening = f"בפרק הזה: {_title(les)}"
        if mood['quiet_start']:
            first['say'] = [opening, *first['say']]
        elif _has(first['say'][:2], INTRO_SAID):
            first['say'] = [hello, *first['say']]
        else:
            first['say'] = [f'{hello} {opening}', *first['say']]
    if mood['end'] in ('quiet', 'said') or _has(last['say'], NEXT_SAID):
        return film
    if k + 1 < len(order):
        see_you = '' if mood['end'] == 'plain' else ' נתראה!'
        last['say'] = [*last['say'], f"ובפרק הבא: {_title(order[k + 1])}{see_you}"]
    else:
        last['say'] = [*last['say'], f'זה היה הפרק האחרון בסדרה "{c["title_he"]}". כל הכבוד שלמדתם איתנו!']
    return film


def lesson_exercises(c, les):
    films = [_film(c, les, lv) for lv in c['levels']]
    mood = _mood(c, les)
    ex = [_framed(c, les, f, mood) for f in films]
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
    ids = {les['id'] for c in out for les in _ordered(c)}
    for lid, words in FILM_MOOD.items():
        assert lid in ids or not strict, (lid, 'FILM_MOOD names no lesson')
        assert set(words.split()) <= {'no_music', 'quiet_start', 'end=quiet', 'end=plain', 'end=said'}, (lid, words)
    for lid in SPOKEN_TITLE:
        assert lid in ids or not strict, (lid, 'SPOKEN_TITLE names no lesson')
    return out


def minutes(c, les, level):
    words = sum(len(line.split()) for s in _film(c, les, level)['scenes'] for line in s['say'])
    return words / 120
