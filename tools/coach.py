#!/usr/bin/env python3
"""Weekly coaching for each learner, from the family's synced logs.

  python3 tools/coach.py summary CODE [--days 7]      per-learner summary as JSON
  python3 tools/coach.py publish CODE PROFILE_ID plan.json

publish writes plan.json to the learner's profile as `coach`; the app shows it
on the path as this week's personal practice. A plan is
  {"week": "YYYY-MM-DD", "title_he": ..., "note_he": ..., "focus": [...],
   "exercise_ids": ["u3l2e4", ...], "exercises": [extra exercise objects]}
Exercises named by id are copied from data/lessons, so they render exactly as in their lesson.
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
        mine = [a for a in attempts if a.get('profile_id') == pid]
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
            'attempts_total': len(mine), 'attempts_week': len(week),
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
    exs = []
    for i in plan.get('exercise_ids', []):
        if i not in bank: sys.exit(f'unknown exercise id {i}')
        exs.append(bank[i])
    exs += plan.get('exercises', [])
    for n, e in enumerate(exs):
        e = dict(e)
        e['id'] = f"coach-{plan['week']}-{n + 1}-{e.get('id', 'x')}"
        exs[n] = e
    if not exs: sys.exit('plan has no exercises')
    coach = {k: plan.get(k) for k in ('week', 'title_he', 'note_he', 'focus')}
    coach['exercises'] = exs
    coach['new_words'] = plan.get('new_words', [])
    coach['made_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    body = json.dumps({'fields': {'coach': enc(coach), 'updated_at': enc(int(datetime.datetime.now().timestamp() * 1000))}}).encode()
    url = f'{BASE}/{code}/profiles/{pid}?updateMask.fieldPaths=coach&updateMask.fieldPaths=updated_at&currentDocument.exists=true&key={API_KEY}'
    req = urllib.request.Request(url, data=body, method='PATCH', headers={'Content-Type': 'application/json'})
    urllib.request.urlopen(req).read()
    print(f'published {len(exs)} exercises to {pid}')


if __name__ == '__main__':
    cmd, code = sys.argv[1], sys.argv[2]
    if cmd == 'summary':
        days = int(sys.argv[sys.argv.index('--days') + 1]) if '--days' in sys.argv else 7
        print(json.dumps(summary(code, days), ensure_ascii=False, indent=1))
    elif cmd == 'publish':
        publish(code, sys.argv[3], sys.argv[4])
