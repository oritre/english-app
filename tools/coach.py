#!/usr/bin/env python3
"""Weekly coaching for each learner, from the family's synced logs.

  python3 tools/coach.py summary CODE [--days 7]      per-learner summary as JSON
  python3 tools/coach.py publish CODE PROFILE_ID plan.json
  python3 tools/coach.py set CODE PROFILE_ID voice_typing=true 'asr="local"'

publish writes plan.json to the learner's profile as `coach`; the app shows it
on the path as this week's feedback and personal practice. A plan is
  {"week": "YYYY-MM-DD", "title_he": ..., "note_he": ...,
   "strengths": ["..."], "work_on": ["..."],
   "modules": [{"title_he": ..., "about_he": ..., "items": ["u3l2e4", {exercise}, ...]}]}
Each module is a short lesson: start with teach cards (type "teach") whose
"narration" is a list of {"he": ...} / {"en": ...} parts read aloud in turn, then
a small quiz. A string item is an exercise id copied from data/lessons, so it
renders exactly as in its lesson; an object is a new exercise in the same schema.

The Brilliant-style courses (data/think.json, lessons t-*) log to the same
attempts, so the summary covers them too. Their exercise types (mcq, number,
balance, fraction, numberline, order, robot, buckets, angle, sim) can be used in
modules; see tools/think_content.py for the schema of each.

Each learner's school grade is profile.grade (1-12, 13 = adult); the catalog
recommends the courses whose grade band (data/think.json courses[].grades)
covers it. To pick the courses yourself for the week:
  python3 tools/coach.py set CODE PROFILE_ID 'think_plan={"week": "YYYY-MM-DD", "courses": ["times", "clock"], "note_he": "..."}'
read_aloud=true reads every think question aloud in Hebrew (young readers;
on by default for grades 1-2).

Level per think course (1 basic, 2 advanced, 3 challenge) sets how hard the
practice rounds are and how many leading units are skipped (level 2 skips one,
level 3 two; they stay open as review). Without a measured level it follows the
grade's place in the course band. think_stats in the summary shows, per course
touched in the last 4 weeks, accuracy and the current level. To set levels:
  python3 tools/coach.py set CODE PROFILE_ID 'think_level={"times": 3, "fractions": 1}'

General knowledge ("ידע כללי", data/know.json, lessons k-*) works the same way:
a narrated cartoon, then a short quiz; know_plan has the same shape as think_plan.
"""
import collections, datetime, glob, json, os, sys, urllib.request

API_KEY = 'AIzaSyA3dpj8qdE8UcQ8MooMoC2waaeOOrTzch4'
BASE = 'https://firestore.googleapis.com/v1/projects/english-app-94b40/databases/(default)/documents/families'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def val(v):
    (k, x), = v.items()
    if k == 'integerValue': return int(x)
    if k == 'doubleValue': return float(x)
    if k == 'nullValue': return None
    if k == 'mapValue': return {a: val(b) for a, b in x.get('fields', {}).items()}
    if k == 'arrayValue': return [val(b) for b in x.get('values', [])]
    return x


def enc(x):
    if x is None: return {'nullValue': None}
    if isinstance(x, bool): return {'booleanValue': x}
    if isinstance(x, int): return {'integerValue': str(x)}
    if isinstance(x, float): return {'doubleValue': x}
    if isinstance(x, str): return {'stringValue': x}
    if isinstance(x, list): return {'arrayValue': {'values': [enc(v) for v in x]}}
    return {'mapValue': {'fields': {k: enc(v) for k, v in x.items()}}}


def fetch(code, store):
    out, token = [], ''
    while True:
        url = f'{BASE}/{code}/{store}?pageSize=300&key={API_KEY}' + (f'&pageToken={token}' if token else '')
        d = json.load(urllib.request.urlopen(url))
        out += [{k: val(v) for k, v in doc.get('fields', {}).items()} for doc in d.get('documents', [])]
        token = d.get('nextPageToken')
        if not token: return out


def lessons():
    ex, titles = {}, {}
    for p in glob.glob(os.path.join(ROOT, 'data/lessons/*.json')):
        l = json.load(open(p, encoding='utf-8'))
        titles[l['id']] = l.get('title_he', l['id'])
        for e in l['exercises']: ex[e['id']] = e
    return ex, titles


def think_courses():
    try:
        return json.load(open(os.path.join(ROOT, 'data/think.json'), encoding='utf-8'))['courses']
    except OSError:
        return []


def grade_level(course, grade):
    """Same as courseLevel() in js/thinkLogic.js when no level was measured."""
    lo, hi = course.get('grades') or (1, 13)
    try:
        g = int(grade)
    except (TypeError, ValueError):
        return 1
    if g <= lo: return 1
    if g > hi: return 3
    t = (g - lo) / max(1, hi - lo)
    return 1 if t < 1 / 3 else 2 if t < 2 / 3 else 3


def subject_of(lesson_id):
    """Same as subjectOf in js/insights.js."""
    i = str(lesson_id or '')
    return 'know' if i.startswith('k-') else 'think' if i.startswith(('t-', 'tp-')) else 'english'


def think_stats(p, results, done, since28):
    """Per think course touched in the last 4 weeks: progress, accuracy and level."""
    out = {}
    levels = p.get('think_level') or {}
    for c in think_courses():
        ids = [l for u in c['units'] for l in u['lessons']]
        rs = [r for r in results if r.get('date', '') >= since28
              and (r.get('lesson_id') in ids or r.get('lesson_id') == f"tp-{c['id']}")]
        if not rs:
            continue
        acc = [r['accuracy'] for r in rs if isinstance(r.get('accuracy'), (int, float))]
        out[c['id']] = {
            'grades': c.get('grades'), 'units': len(c['units']),
            'lessons_done': f"{sum(1 for l in ids if l in done)}/{len(ids)}",
            'rounds_4w': len(rs), 'practice_rounds_4w': sum(1 for r in rs if str(r.get('lesson_id')).startswith('tp-')),
            'accuracy_4w': round(sum(acc) / len(acc)) if acc else None,
            'accuracy_last3': [r.get('accuracy') for r in sorted(rs, key=lambda r: r.get('date', ''))[-3:]],
            'level': levels.get(c['id']), 'level_by_grade': grade_level(c, p.get('grade')),
        }
    return out


def summary(code, days):
    profiles = fetch(code, 'profiles')
    attempts = fetch(code, 'attempts')
    results = fetch(code, 'results')
    progress = fetch(code, 'progress')
    _, titles = lessons()
    since = (datetime.date.today() - datetime.timedelta(days=days)).isoformat()
    out = []
    for p in profiles:
        pid = p['id']
        talks = [a for a in attempts if a.get('profile_id') == pid and a.get('type') == 'talk' and a.get('date', '') >= since]
        mine = [a for a in attempts if a.get('profile_id') == pid and a.get('type') not in ('talk', 'session')]
        sessions = [a for a in attempts if a.get('profile_id') == pid and a.get('type') == 'session' and a.get('date', '') >= since]
        week = [a for a in mine if a.get('date', '') >= since]
        by_type = collections.defaultdict(lambda: [0, 0])
        for a in week:
            by_type[a['type']][0] += 1
            by_type[a['type']][1] += a.get('outcome') in ('correct', 'typo')
        wrong = collections.Counter()
        for a in mine:
            if a.get('outcome') in ('wrong', 'retry') and a.get('expected') is not None:
                wrong[(a.get('exercise_id'), a.get('expected'), a.get('given'))] += 1
        hesit = collections.Counter()
        for a in week:
            picks = [t['v'] for t in a.get('taps') or [] if t.get('k') in ('choice', 'tile', 'letter')]
            for v in set(picks):
                if a.get('expected') and v.lower() != str(a['expected']).lower() and v.lower() not in str(a['expected']).lower():
                    hesit[(a.get('expected'), v)] += 1
        hours = collections.defaultdict(lambda: [0, 0])
        for a in week:
            h = int(a.get('hour') or 0)
            hours[h][0] += 1
            hours[h][1] += a.get('outcome') in ('correct', 'typo')
        done = sorted({r['lesson_id'] for r in progress if r.get('profile_id') == pid and r.get('status') == 'done' and not r.get('skipped')})
        res = [r for r in results if r.get('profile_id') == pid and r.get('date', '') >= since]
        coach_done = [r for r in res if str(r.get('lesson_id', '')).startswith('coach')]
        out.append({
            'profile_id': pid, 'name': p.get('name'), 'starter': p.get('starter'), 'voice_typing': p.get('voice_typing'),
            'placement': p.get('placement'), 'current_coach': p.get('coach'),
            'talk': p.get('talk'), 'unseen': p.get('unseen'), 'talk_focus': p.get('talk_focus'),
            'grade': p.get('grade'), 'read_aloud': p.get('read_aloud'), 'think_plan': p.get('think_plan'),
            'think_done': [i for i in done if i.startswith('t-')],
            'know_plan': p.get('know_plan'), 'know_done': [i for i in done if i.startswith('k-')],
            # Practice rounds (tp-<course>) this week: a finished course still being practised.
            'think_level': p.get('think_level'),
            'think_stats': think_stats(p, [r for r in results if r.get('profile_id') == pid], set(done),
                                       (datetime.date.today() - datetime.timedelta(days=28)).isoformat()),
            'think_practice_week': dict(collections.Counter(r['lesson_id'][3:] for r in res if str(r.get('lesson_id', '')).startswith('tp-'))),
            # Spoken lessons with the AI tutor: what was said, to find recurring speaking mistakes.
            'talks_week': [{'date': a.get('date'), 'topic': a.get('topic'), 'sec': round((a.get('ms') or 0) / 1000),
                            'transcript': a.get('transcript')} for a in sorted(talks, key=lambda a: a.get('at') or 0)],
            'attempts_total': len(mine), 'attempts_week': len(week),
            # Active minutes (taps, video or talk in the last 45 s) per tab, and minutes the screen was just open.
            'active_min_week': {s: round(sum(a.get('active_s') or 0 for a in sessions if subject_of(a.get('lesson_id')) == s) / 60)
                                for s in ('english', 'think', 'know')},
            'open_min_week': round(sum(a.get('open_s') or 0 for a in sessions) / 60),
            'goals': p.get('goals'),
            'days_active_week': sorted({a['date'] for a in week}),
            'lessons_done': done, 'lessons_done_titles': [titles.get(i, i) for i in done[-8:]],
            'results_week': [{k: r.get(k) for k in ('date', 'lesson_id', 'accuracy', 'duration_s', 'xp')} for r in res],
            'coach_done_week': len(coach_done),
            'accuracy_by_type_week': {t: f'{c}/{n}' for t, (n, c) in by_type.items()},
            'by_hour_week': {h: f'{c}/{n}' for h, (n, c) in sorted(hours.items())},
            'top_mistakes_all_time': [{'exercise_id': e, 'expected': x, 'given': g, 'times': n} for (e, x, g), n in wrong.most_common(25)],
            'hesitations_week': [{'expected': x, 'also_tapped': v, 'times': n} for (x, v), n in hesit.most_common(15)],
            'slowest_week': sorted(({'exercise_id': a.get('exercise_id'), 'sec': round((a.get('ms') or 0) / 1000), 'outcome': a.get('outcome')} for a in week), key=lambda r: -r['sec'])[:8],
        })
    return out


def publish(code, pid, plan_path):
    plan = json.load(open(plan_path, encoding='utf-8'))
    bank, _ = lessons()
    week = plan['week']
    modules = []
    for mi, m in enumerate(plan['modules']):
        exs = []
        for n, item in enumerate(m['items']):
            if isinstance(item, str):
                if item not in bank: sys.exit(f'unknown exercise id {item}')
                item = bank[item]
            e = dict(item)
            e['id'] = f"coach-{week}-{mi + 1}-{n + 1}-{e.get('id', 'x')}"
            exs.append(e)
        if not exs: sys.exit(f'module {mi + 1} has no exercises')
        # Firestore can't hold arrays inside arrays (match_pairs), so exercises travel as JSON text.
        modules.append({'title_he': m['title_he'], 'about_he': m.get('about_he', ''), 'exercises_json': json.dumps(exs, ensure_ascii=False)})
    coach = {k: plan.get(k) for k in ('week', 'title_he', 'note_he', 'strengths', 'work_on')}
    coach['modules'] = modules
    coach['made_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    patch(code, pid, {'coach': coach})
    print(f'published {len(modules)} modules, {sum(len(json.loads(m["exercises_json"])) for m in modules)} exercises to {pid}')


def patch(code, pid, fields):
    """Sets only these profile fields; the newer updated_at makes devices take them on their next sync."""
    fields = dict(fields, updated_at=int(datetime.datetime.now().timestamp() * 1000))
    mask = ''.join(f'updateMask.fieldPaths={k}&' for k in fields)
    body = json.dumps({'fields': {k: enc(v) for k, v in fields.items()}}).encode()
    url = f'{BASE}/{code}/profiles/{pid}?{mask}currentDocument.exists=true&key={API_KEY}'
    urllib.request.urlopen(urllib.request.Request(url, data=body, method='PATCH', headers={'Content-Type': 'application/json'})).read()

if __name__ == '__main__':
    cmd, code = sys.argv[1], sys.argv[2]
    if cmd == 'summary':
        days = int(sys.argv[sys.argv.index('--days') + 1]) if '--days' in sys.argv else 7
        print(json.dumps(summary(code, days), ensure_ascii=False, indent=1))
    elif cmd == 'publish':
        publish(code, sys.argv[3], sys.argv[4])
    elif cmd == 'set':  # set CODE PROFILE_ID field=json ...  e.g. voice_typing=true asr='"local"'
        patch(code, sys.argv[3], {k: json.loads(v) for k, v in (a.split('=', 1) for a in sys.argv[4:])})
        print('set', ', '.join(sys.argv[4:]))
