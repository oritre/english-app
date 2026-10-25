"""Video server for the לימודים app's general-knowledge tab (Home Assistant add-on).

Downloads every video listed in the app's data/videos.json once from YouTube
(yt-dlp, into /media/english-app), then serves the files to the app, so the
kids watch without YouTube, without ads, and with HomeGuard's internet off.

A file is served only with ?k=<key>, the key the app derives from the family
sync code: the first 16 hex digits of SHA-256("media:" + code) (js/media.js).
Pure standard library apart from yt-dlp. Port 8811.
"""
import hashlib
import json
import logging
import os
import re
import subprocess
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

OPTIONS = '/data/options.json'
STORE = '/media/english-app'
PORT = 8811
REFRESH_S = 6 * 3600
ID_RE = re.compile(r'^[A-Za-z0-9_-]{11}$')

log = logging.getLogger('english_media')
status = {'videos': 0, 'ready': 0, 'failed': {}, 'last_check': None}


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
                            f"{len(status['failed'])} failed; last check {status['last_check']}")
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

    def send_file(self, file):
        size = os.path.getsize(file)
        rng = parse_range(self.headers.get('Range'), size)
        start, end = rng or (0, size - 1)
        self.send_response(206 if rng else 200)
        self.cors()
        self.send_header('Content-Type', 'video/mp4')
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'private, max-age=86400')
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
    if not Handler.keys:
        log.warning('No family_code set: every video request will be refused.')
    threading.Thread(target=refresher, args=(options,), daemon=True).start()
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()


if __name__ == '__main__':
    main()
