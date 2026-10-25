"""Builds data/know.json and data/lessons/k-*.json: general knowledge ("ידע כללי").

After BrainPOP, but all in Hebrew and with our own content: every lesson is a
short narrated cartoon (a `story`: scenes of emoji on a painted backdrop, read
aloud by the device's Hebrew voice, with subtitles), then a short multiple
choice quiz. A lesson may instead open with an embedded `video` from an
approved Hebrew channel (see VIDEOS in know_videos.py).

Content rules (ori, 2026-10-25): Hebrew only. Factual and neutral, respectful
of Jewish tradition and of Israel; history is told as it happened, without
social or political agendas from either side. Torah stories are told in a
traditional, respectful voice ("התורה מספרת").

The courses live in know_israel.py (Jewish people and the Land of Israel) and
know_world.py (history, society, nature). Run: python3 tools/know_content.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
ROOT = os.path.join(os.path.dirname(__file__), '..', 'data')

AREAS = [
    ('israel', '🇮🇱', 'עם ישראל וארץ ישראל'),
    ('history', '🏛️', 'היסטוריה ועולם'),
    ('society', '💰', 'כלכלה וחברה'),
    ('nature', '🌿', 'טבע, גוף וחלל'),
]


def S(bg, art, text_he, tag=None):
    """One scene of the cartoon: a backdrop, emoji art (first one is the star), the narration."""
    s = {'bg': bg, 'art': art, 'text_he': text_he}
    if tag:
        s['tag'] = tag
    return s


def Q(prompt_he, answer, wrong, explain_he):
    """A quiz question: the right answer and the wrong options (shuffled in the app)."""
    return {'type': 'mcq', 'prompt_he': prompt_he, 'answer': answer, 'options': [answer, *wrong], 'explain_he': explain_he}


def L(lesson_id, title_he, icon, scenes, quiz, bg='night'):
    """A lesson: the cartoon, then the quiz."""
    story = {'type': 'story', 'title_he': title_he, 'icon': icon, 'bg': bg, 'scenes': scenes}
    return (lesson_id, title_he, [story, *quiz])


def course(cid, area, icon, color, title_he, about_he, grades, lessons):
    return {'id': cid, 'area': area, 'icon': icon, 'color': color, 'title_he': title_he, 'about_he': about_he,
            'grades': grades, 'units': [{'id': f'k-{cid}', 'title_he': title_he, 'about_he': about_he, 'lessons': lessons}]}


def main():
    from know_israel import COURSES as ISRAEL
    from know_world import COURSES as WORLD
    from know_videos import VIDEOS
    os.makedirs(os.path.join(ROOT, 'lessons'), exist_ok=True)
    out = {'areas': [{'id': i, 'icon': ic, 'title_he': t} for i, ic, t in AREAS], 'courses': [], 'lesson_titles': {}}
    count = 0
    seen = set()
    for c in ISRAEL + WORLD:
        units = []
        for u in c['units']:
            ids = []
            for lesson_id, title_he, exercises in u['lessons'] + VIDEOS.get(c['id'], []):
                assert lesson_id.startswith('k-') and lesson_id not in seen, f'bad or duplicate lesson id {lesson_id}'
                seen.add(lesson_id)
                for i, ex in enumerate(exercises):
                    ex['id'] = f'{lesson_id}e{i + 1}'
                lesson = {'id': lesson_id, 'unit_id': u['id'], 'course': c['id'], 'title_he': title_he, 'exercises': exercises}
                with open(os.path.join(ROOT, 'lessons', f'{lesson_id}.json'), 'w', encoding='utf-8') as f:
                    json.dump(lesson, f, ensure_ascii=False, indent=1)
                out['lesson_titles'][lesson_id] = title_he
                ids.append(lesson_id)
                count += len(exercises)
            units.append({'id': u['id'], 'title_he': u['title_he'], 'about_he': u['about_he'], 'lessons': ids})
        out['courses'].append({k: c[k] for k in ('id', 'area', 'icon', 'color', 'title_he', 'about_he', 'grades')} | {'units': units})
    with open(os.path.join(ROOT, 'know.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"{len(out['courses'])} courses, {len(out['lesson_titles'])} lessons, {count} exercises")


if __name__ == '__main__':
    main()
