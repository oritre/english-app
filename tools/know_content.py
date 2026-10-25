"""Builds data/know.json and data/lessons/k-*.json: general knowledge ("ידע כללי").

After BrainPOP, all in Hebrew: every lesson is a real video from a channel ori
approved (tools/know_videos.py), then a short multiple-choice quiz. ori
(2026-10-25): only real videos, no home-made cartoons; a topic with no
approved video is left out until one is found.

The quiz is fitted to the learner's school grade: a video's questions come in
grade bands, and the app shows each child the band for their grade
(js/storyLogic.js forGrade).

Content rules (ori, 2026-10-25): Hebrew only. Factual and neutral, respectful
of Jewish tradition and of Israel; history is told as it happened, without
social or political agendas from either side.

Run: python3 tools/know_content.py
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


def Q(prompt_he, answer, wrong, explain_he):
    """A quiz question: the right answer and the wrong options (shuffled in the app)."""
    return {'type': 'mcq', 'prompt_he': prompt_he, 'answer': answer, 'options': [answer, *wrong], 'explain_he': explain_he}


# The topics, in catalog order: (id, area, icon, color, title, about, grades).
# A topic shows only when it has videos.
COURSES = [
    ('holidays', 'israel', '🕎', '#d97706', 'חגי ישראל', 'מה חוגגים בכל חג, ולמה', [1, 4]),
    ('bereshit', 'israel', '📜', '#7c3aed', 'סיפורי בראשית', 'בריאת העולם, נח, האבות ויוסף', [1, 4]),
    ('exodus', 'israel', '🌊', '#0e7490', 'משה ויציאת מצרים', 'מהתיבה ביאור ועד הר סיני', [2, 5]),
    ('kings', 'israel', '👑', '#b45309', 'מלכים ובית המקדש', 'דוד, שלמה, החורבן והשיבה לציון', [4, 7]),
    ('land', 'israel', '🗺️', '#16a34a', 'מסע בארץ ישראל', 'ירושלים, הצפון והדרום', [2, 6]),
    ('zionism', 'israel', '🇮🇱', '#2563eb', 'הציונות והקמת המדינה', 'הרצל, בן־יהודה, העליות והעצמאות', [5, 8]),
    ('wars', 'israel', '🛡️', '#475569', 'מלחמות ישראל', 'העצמאות, ששת הימים ויום כיפור', [7, 8]),
    ('holocaust', 'israel', '🕯️', '#334155', 'השואה', 'מה קרה, ומה למדנו', [7, 8]),
    ('egypt', 'history', '🔺', '#ca8a04', 'מצרים העתיקה', 'פירמידות, פרעונים וכתב חרטומים', [4, 6]),
    ('greece', 'history', '🏛️', '#0369a1', 'יוון ורומא', 'דמוקרטיה, פילוסופיה ואימפריה', [6, 8]),
    ('inventors', 'history', '💡', '#eab308', 'ממציאים ששינו את העולם', 'דפוס, חשמל, מטוסים והמצאות ישראליות', [3, 7]),
    ('world', 'history', '🌍', '#0891b2', 'יבשות ואוקיינוסים', 'מסע סביב כדור הארץ', [3, 6]),
    ('money', 'society', '💰', '#15803d', 'כסף וכלכלה', 'מסחר, חיסכון, שוק ומסים', [2, 8]),
    ('animals', 'nature', '🦁', '#65a30d', 'עולם החי', 'יונקים, עופות, דגים וחיות בישראל', [1, 4]),
    ('body', 'nature', '❤️', '#e11d48', 'גוף האדם', 'הלב, השלד והחושים', [2, 6]),
    ('space', 'nature', '🪐', '#4338ca', 'כדור הארץ והחלל', 'השמש, הכוכבים, הירח ואילן רמון', [2, 6]),
    ('water', 'nature', '💧', '#0284c7', 'מים ומזג אוויר', 'מחזור המים, גשם ועונות בישראל', [1, 4]),
]
KEYS = ('id', 'area', 'icon', 'color', 'title_he', 'about_he', 'grades')


def main():
    from know_videos import VIDEOS
    lessons_dir = os.path.join(ROOT, 'lessons')
    os.makedirs(lessons_dir, exist_ok=True)
    for name in os.listdir(lessons_dir):  # start clean: lessons of removed videos go too
        if name.startswith('k-'):
            os.remove(os.path.join(lessons_dir, name))
    out = {'areas': [{'id': i, 'icon': ic, 'title_he': t} for i, ic, t in AREAS], 'courses': [], 'lesson_titles': {}}
    videos = []
    count = 0
    seen = set()
    for row in COURSES:
        c = dict(zip(KEYS, row))
        ids = []
        for lesson_id, title_he, exercises in VIDEOS.pop(c['id'], []):
            assert lesson_id.startswith('k-') and lesson_id not in seen, f'bad or duplicate lesson id {lesson_id}'
            seen.add(lesson_id)
            for i, ex in enumerate(exercises):
                ex['id'] = f'{lesson_id}e{i + 1}'
            lesson = {'id': lesson_id, 'unit_id': f"k-{c['id']}", 'course': c['id'], 'title_he': title_he, 'exercises': exercises}
            with open(os.path.join(lessons_dir, f'{lesson_id}.json'), 'w', encoding='utf-8') as f:
                json.dump(lesson, f, ensure_ascii=False, indent=1)
            out['lesson_titles'][lesson_id] = title_he
            videos.append({'youtube': exercises[0]['youtube'], 'lesson': lesson_id, 'title_he': exercises[0]['title_he']})
            ids.append(lesson_id)
            count += len(exercises)
        if ids:
            out['courses'].append(c | {'units': [{'id': f"k-{c['id']}", 'title_he': c['title_he'], 'about_he': c['about_he'], 'lessons': ids}]})
    assert not VIDEOS, f'videos for unknown courses: {list(VIDEOS)}'
    with open(os.path.join(ROOT, 'know.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    # The list the Pi add-on (pi/english_media) downloads and serves.
    with open(os.path.join(ROOT, 'videos.json'), 'w', encoding='utf-8') as f:
        json.dump(videos, f, ensure_ascii=False, indent=1)
    print(f"{len(out['courses'])} courses, {len(out['lesson_titles'])} lessons, {count} exercises")


if __name__ == '__main__':
    main()
