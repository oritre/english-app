"""Video and voice server for the לימודים app (Home Assistant add-on).

Downloads every video listed in the app's data/videos.json once from YouTube
(yt-dlp, into /media/english-app), then serves the files to the app, so the
kids watch without YouTube, without ads, and with HomeGuard's internet off.

A file is served only with ?k=<key>, the key the app derives from the family
sync code: the first 16 hex digits of SHA-256("media:" + code) (js/media.js).
It also reads the app's words and sentences aloud in a natural voice
(/tts): each line is made once with Gemini text-to-speech, using the key in the
add-on options, and kept as an mp3 in /media/english-app/tts.

Pure standard library apart from yt-dlp and ffmpeg. Port 8811.
"""
import base64
import hashlib
import json
import logging
import os
import re
import subprocess
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

OPTIONS = '/data/options.json'
STORE = '/media/english-app'
PORT = 8811
REFRESH_S = 6 * 3600
ID_RE = re.compile(r'^[A-Za-z0-9_-]{11}$')

TTS_MAX_CHARS = 600
TTS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
TTS_STYLE = 'Warm, clear and calm, like a friendly teacher reading to a child. Natural pace.'
tts_slots = threading.Semaphore(2)
tts_locks = {}
tts_locks_guard = threading.Lock()

log = logging.getLogger('english_media')
status = {'videos': 0, 'ready': 0, 'failed': {}, 'last_check': None, 'tts_made': 0, 'tts_error': None}


def load_options(path=OPTIONS):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def media_key(code):
    code = re.sub(r'[^0-9A-Z]', '', str(code or '').upper())
    return hashlib.sha256(f'media:{code}'.encode()).hexdigest()[:16] if code else None


def keys_from(options):
    """Several family codes may be given, separated by commas."""
    return {k for k in (media_key(c) for c in str(options.get('family_code') or '').split(',')) if k}


def video_path(vid, store=STORE):
    return os.path.join(store, f'{vid}.mp4')


def parse_range(header, size):
    """'bytes=a-b' -> (start, end) inclusive, or None when absent or unusable."""
    m = re.fullmatch(r'bytes=(\d*)-(\d*)', (header or '').strip())
    if not m or (not m.group(1) and not m.group(2)):
        return None
    if m.group(1):
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else size - 1
    else:  # the last N bytes
        start, end = max(0, size - int(m.group(2))), size - 1
    if start >= size or start > end:
        return None
    return start, min(end, size - 1)


def download(vid, quality, store=STORE):
    """One video, as a single mp4 no taller than `quality`. True when it is there."""
    target = video_path(vid, store)
    if os.path.exists(target):
        return True
    tmp = os.path.join(store, f'.{vid}.part.mp4')
    fmt = (f'bv*[height<={quality}][ext=mp4]+ba[ext=m4a]/'
           f'b[height<={quality}][ext=mp4]/bv*[height<={quality}]+ba/b')
    cmd = ['yt-dlp', '--quiet', '--no-warnings', '--no-playlist', '--js-runtimes', 'node', '-f', fmt,
           '--merge-output-format', 'mp4', '--remux-video', 'mp4', '-o', tmp,
           f'https://www.youtube.com/watch?v={vid}']
    try:
        subprocess.run(cmd, check=True, timeout=1800, capture_output=True, text=True)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        status['failed'][vid] = (getattr(e, 'stderr', '') or str(e))[-300:]
        log.warning('download %s failed: %s', vid, status['failed'][vid])
        return False
    os.replace(tmp, target)
    status['failed'].pop(vid, None)
    log.info('downloaded %s (%.1f MB)', vid, os.path.getsize(target) / 1e6)
    return True


def tts_hash(lang, text):
    """Matches js/speech.js: SHA-1 of "<lang>\n<text>", first 16 hex digits."""
    return hashlib.sha1(f'{lang}\n{text.strip()}'.encode()).hexdigest()[:16]


def tts_path(h, store=STORE):
    return os.path.join(store, 'tts', f'{h}.mp3')


def find_audio(obj):
    """The base64 audio in a TTS response, whatever its exact nesting:
    (data, mime). Interactions put it in steps[].content[] with type 'audio';
    generateContent in candidates[].content.parts[].inlineData."""
    if isinstance(obj, dict):
        data = obj.get('data')
        mime = str(obj.get('mime_type') or obj.get('mimeType') or '')
        if isinstance(data, str) and len(data) > 100 and (obj.get('type') == 'audio' or mime.startswith('audio')):
            return data, mime or 'audio/wav'
        for v in obj.values():
            found = find_audio(v)
            if found:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = find_audio(v)
            if found:
                return found
    return None


def tts_request(text, options):
    """Natural speech for one line, as (audio bytes, mime)."""
    body = {
        'model': options.get('tts_model') or 'gemini-3.8-flash-tts',
        'input': [{'type': 'user_input', 'content': [{
            'type': 'text', 'text': text,
            'annotations': [{'type': 'speech_metadata', 'style': TTS_STYLE}]}]}],
        'response_format': {'type': 'audio'},
        'generation_config': {'speech_config': [{'voice': options.get('tts_voice') or 'Sulafat'}]},
    }
    req = urllib.request.Request(TTS_URL, data=json.dumps(body).encode(), method='POST', headers={
        'Content-Type': 'application/json', 'x-goog-api-key': options.get('gemini_api_key') or ''})
    with urllib.request.urlopen(req, timeout=60) as r:
        found = find_audio(json.load(r))
    if not found:
        raise ValueError('no audio in the response')
    return base64.b64decode(found[0]), found[1]


def to_mp3(audio, mime, target):
    """WAV (or raw 24 kHz 16-bit PCM) to a small mono mp3."""
    mime = mime.lower()
    rate = re.search(r'rate=(\d+)', mime)
    raw = 'l16' in mime or 'pcm' in mime
    fmt = ['-f', 's16le', '-ar', rate.group(1) if rate else '24000', '-ac', '1'] if raw else []
    tmp = f'{target}.part.mp3'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *fmt, '-i', 'pipe:0', '-ac', '1', '-b:a', '48k', tmp],
                   input=audio, check=True, timeout=60, capture_output=True)
    os.replace(tmp, target)


def tts_file(text, lang, options, store=STORE, request=None):
    """The mp3 for one line, made on first use. Raises when it cannot be made."""
    request = request or tts_request
    h = tts_hash(lang, text)
    target = tts_path(h, store)
    if os.path.exists(target):
        return target
    if not options.get('gemini_api_key'):
        raise LookupError('no gemini_api_key in the add-on options')
    with tts_locks_guard:
        lock = tts_locks.setdefault(h, threading.Lock())
    with lock, tts_slots:
        if not os.path.exists(target):
            os.makedirs(os.path.dirname(target), exist_ok=True)
            try:
                audio, mime = request(text.strip(), options)
                to_mp3(audio, mime, target)
            except Exception as e:
                status['tts_error'] = f'{time.strftime("%H:%M")} {str(e)[:200]}'
                raise
            status['tts_made'] += 1
            status['tts_error'] = None
    return target


def refresh(options):
    """Fetch the list and download what is missing. Files of videos no longer listed stay."""
    url = options.get('videos_url') or 'https://oritre.github.io/english-app/data/videos.json'
    try:
        with urllib.request.urlopen(f'{url}?t={int(time.time())}', timeout=30) as r:
            listed = json.load(r)
    except (OSError, ValueError) as e:
        log.warning('could not read the video list: %s', e)
        return
    ids = [v['youtube'] for v in listed if ID_RE.match(str(v.get('youtube', '')))]
    status['videos'] = len(ids)
    for vid in ids:
        download(vid, int(options.get('quality') or 720))
    status['ready'] = sum(os.path.exists(video_path(v)) for v in ids)
    status['last_check'] = time.strftime('%Y-%m-%d %H:%M')
    log.info('%d of %d videos ready', status['ready'], len(ids))


def refresher(options):
    while True:
        try:
            refresh(options)
        except Exception:  # keep serving whatever happens
            log.exception('refresh failed')
        time.sleep(REFRESH_S)


class Handler(BaseHTTPRequestHandler):
    keys = set()
    store = STORE
    options = {}

    def log_message(self, fmt, *args):
        log.debug(fmt, *args)

    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Allow-Headers', 'Range')
        self.send_header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')

    def plain(self, code, text):
        body = text.encode()
        self.send_response(code)
        self.cors()
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        self.end_headers()

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path, _, query = self.path.partition('?')
        params = dict(p.partition('=')[::2] for p in query.split('&') if p)
        if path == '/status':
            self.plain(200, f"{status['ready']} of {status['videos']} videos ready; "
                            f"{len(status['failed'])} failed; last check {status['last_check']}; "
                            f"voice: {status['tts_made']} made since start"
                            + (f", last error {status['tts_error']}" if status['tts_error'] else ''))
            return
        t = re.fullmatch(r'/tts/([0-9a-f]{16})\.mp3', path)
        if t:
            self.tts(t.group(1), params)
            return
        m = re.fullmatch(r'/v/([A-Za-z0-9_-]{11})\.mp4', path)
        if not m:
            self.plain(404, 'not found')
            return
        if params.get('k') not in self.keys:
            self.plain(403, 'this device is not in the family')
            return
        file = video_path(m.group(1), self.store)
        if not os.path.exists(file):
            self.plain(404, 'not downloaded yet')
            return
        self.send_file(file)

    def tts(self, h, params):
        """/tts/<hash>.mp3?k=&l=en|he&t=<text>[&warm=1]: the line in a natural voice."""
        if params.get('k') not in self.keys:
            self.plain(403, 'this device is not in the family')
            return
        lang = params.get('l', '')
        text = urllib.parse.unquote_plus(params.get('t', '')).strip()
        if lang not in ('en', 'he') or not text or len(text) > TTS_MAX_CHARS or tts_hash(lang, text) != h:
            self.plain(400, 'bad line')
            return
        try:
            file = tts_file(text, lang, self.options, self.store)
        except LookupError as e:
            self.plain(404, str(e))
            return
        except Exception:  # the app falls back to the device's own voice
            self.plain(503, 'could not make the voice now')
            return
        if params.get('warm'):
            self.plain(200, 'ok')
            return
        self.send_file(file, 'audio/mpeg', 'public, max-age=31536000, immutable')

    def send_file(self, file, ctype='video/mp4', cache='private, max-age=86400'):
        size = os.path.getsize(file)
        rng = parse_range(self.headers.get('Range'), size)
        start, end = rng or (0, size - 1)
        self.send_response(206 if rng else 200)
        self.cors()
        self.send_header('Content-Type', ctype)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', cache)
        self.send_header('Content-Length', str(end - start + 1))
        if rng:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        if self.command == 'HEAD':
            return
        with open(file, 'rb') as f:
            f.seek(start)
            left = end - start + 1
            try:
                while left > 0:
                    chunk = f.read(min(256 * 1024, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
            except (BrokenPipeError, ConnectionResetError):
                pass  # the player seeks by dropping the connection


def main():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    options = load_options()
    os.makedirs(STORE, exist_ok=True)
    Handler.keys = keys_from(options)
    Handler.options = options
    if not Handler.keys:
        log.warning('No family_code set: every video request will be refused.')
    threading.Thread(target=refresher, args=(options,), daemon=True).start()
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()


if __name__ == '__main__':
    main()
