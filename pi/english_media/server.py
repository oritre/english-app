"""Video and voice server for the לימודים app (Home Assistant add-on).

Downloads every video listed in the app's data/videos.json once from YouTube
(yt-dlp, into /media/english-app), then serves the files to the app, so the
kids watch without YouTube, without ads, and with HomeGuard's internet off.

A file is served only with ?k=<key>, the key the app derives from the family
sync code: the first 16 hex digits of SHA-256("media:" + code) (js/media.js).
It also reads the app's words and sentences aloud in a natural voice
(/tts): each line is made once with Gemini text-to-speech, using the key in the
add-on options, and kept as an mp3 in /media/english-app/tts.
And it paints the parasha films' illustrations (/img): each picture is made
once by a Gemini image model and kept as a jpg in /media/english-app/img.

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
import urllib.error
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

# Billing (ori, 2026-11-15): nothing may run on the paid Gemini API balance.
# Calls go through Vertex AI in the Google Cloud project, which the account's
# welcome credit pays for. Without a vertex_api_key nothing is made (the app
# then uses the device's voice and its drawn backdrops), unless the options
# say allow_paid_key: true, which uses gemini_api_key on the paid Gemini API.
VERTEX_TTS_MODEL = 'gemini-2.5-flash-tts'


def backend(options):
    """'vertex', 'paid' or None: who may be asked to make a line or a picture."""
    if options.get('vertex_api_key'):
        return 'vertex'
    if options.get('allow_paid_key') and options.get('gemini_api_key'):
        return 'paid'
    return None


def vertex_url(options, model):
    project = options.get('vertex_project') or 'secretary-bot-511411'
    loc = options.get('vertex_location') or 'global'
    host = 'aiplatform.googleapis.com' if loc == 'global' else f'{loc}-aiplatform.googleapis.com'
    return (f'https://{host}/v1/projects/{project}/locations/{loc}/publishers/google/models/{model}:generateContent'
            f'?key={urllib.parse.quote(options["vertex_api_key"])}')


def post_json(url, body, headers=None, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST',
                                 headers={'Content-Type': 'application/json', **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise ValueError(f'HTTP {e.code}: {e.read()[:300].decode(errors="replace")}') from e


NO_BACKEND = 'no vertex_api_key in the add-on options (the paid Gemini key is not used)'

IMG_MAX_CHARS = 1800
IMG_URL = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
IMG_MODEL = 'gemini-2.5-flash-image'
img_slots = threading.Semaphore(1)

log = logging.getLogger('english_media')
status = {'videos': 0, 'ready': 0, 'failed': {}, 'last_check': None, 'tts_made': 0, 'tts_error': None, 'img_made': 0, 'img_error': None}


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


def tts_hash(lang, text, voice='', style=''):
    """Matches js/speech.js: SHA-1 of "<lang>\n<text>", first 16 hex digits.
    A line in a character's own voice (film dialogue) hashes "<lang>|<voice>|<style>\n<text>"."""
    head = f'{lang}|{voice}|{style}' if voice or style else lang
    return hashlib.sha1(f'{head}\n{text.strip()}'.encode()).hexdigest()[:16]


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


def tts_request(text, options, voice='', style=''):
    """Natural speech for one line, as (audio bytes, mime). voice/style give a film character its own voice."""
    voice = voice or options.get('tts_voice') or 'Sulafat'
    style = style or TTS_STYLE
    if backend(options) == 'vertex':
        body = {
            'contents': [{'role': 'user', 'parts': [{'text': f'{style}\n\n{text}'}]}],
            'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {
                'prebuiltVoiceConfig': {'voiceName': voice}}}},
        }
        found = find_audio(post_json(vertex_url(options, options.get('vertex_tts_model') or VERTEX_TTS_MODEL), body, timeout=60))
        if not found:
            raise ValueError('no audio in the response')
        return base64.b64decode(found[0]), found[1]
    body = {
        'model': options.get('tts_model') or 'gemini-3.8-flash-tts',
        'input': [{'type': 'user_input', 'content': [{
            'type': 'text', 'text': text,
            'annotations': [{'type': 'speech_metadata', 'style': style}]}]}],
        'response_format': {'type': 'audio'},
        'generation_config': {'speech_config': [{'voice': voice}]},
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


def tts_file(text, lang, options, store=STORE, request=None, voice='', style=''):
    """The mp3 for one line, made on first use. Raises when it cannot be made."""
    request = request or tts_request
    extra = {'voice': voice, 'style': style} if voice or style else {}
    h = tts_hash(lang, text, voice, style)
    target = tts_path(h, store)
    if os.path.exists(target):
        return target
    if not backend(options):
        raise LookupError(NO_BACKEND)
    with tts_locks_guard:
        lock = tts_locks.setdefault(h, threading.Lock())
    with lock, tts_slots:
        if not os.path.exists(target):
            os.makedirs(os.path.dirname(target), exist_ok=True)
            try:
                audio, mime = request(text.strip(), options, **extra)
                to_mp3(audio, mime, target)
            except Exception as e:
                status['tts_error'] = f'{time.strftime("%H:%M")} {str(e)[:200]}'
                raise
            status['tts_made'] += 1
            status['tts_error'] = None
    return target


def img_hash(prompt):
    """Matches js/media.js imageUrl: SHA-1 of "img\n<prompt>", first 16 hex digits."""
    return hashlib.sha1(f'img\n{prompt.strip()}'.encode()).hexdigest()[:16]


def img_path(h, store=STORE):
    return os.path.join(store, 'img', f'{h}.jpg')


def find_image(obj):
    """The base64 picture in a generateContent response: (data, mime)."""
    if isinstance(obj, dict):
        data = obj.get('data')
        mime = str(obj.get('mime_type') or obj.get('mimeType') or '')
        if isinstance(data, str) and len(data) > 100 and mime.startswith('image'):
            return data, mime
        for v in obj.values():
            found = find_image(v)
            if found:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = find_image(v)
            if found:
                return found
    return None


def img_request(prompt, options):
    """One wide illustration for the prompt, as (image bytes, mime)."""
    model = options.get('img_model') or IMG_MODEL
    body = {
        'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
        'generationConfig': {'responseModalities': ['TEXT', 'IMAGE'], 'imageConfig': {'aspectRatio': '16:9'}},
    }
    if backend(options) == 'vertex':
        found = find_image(post_json(vertex_url(options, model), body))
        if not found:
            raise ValueError('no image in the response')
        return base64.b64decode(found[0]), found[1]
    req = urllib.request.Request(IMG_URL.format(model=model), data=json.dumps(body).encode(), method='POST', headers={
        'Content-Type': 'application/json', 'x-goog-api-key': options.get('gemini_api_key') or ''})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            found = find_image(json.load(r))
    except urllib.error.HTTPError as e:
        raise ValueError(f'HTTP {e.code}: {e.read()[:300].decode(errors="replace")}') from e
    if not found:
        raise ValueError('no image in the response')
    return base64.b64decode(found[0]), found[1]


def to_jpg(image, target):
    """Any picture to a 1280-wide jpg, small enough for a phone."""
    tmp = f'{target}.part.jpg'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', 'pipe:0', '-vf', 'scale=1280:-2', '-q:v', '4', tmp],
                   input=image, check=True, timeout=60, capture_output=True)
    os.replace(tmp, target)


def img_file(prompt, options, store=STORE, request=None):
    """The jpg for one prompt, painted on first use. Raises when it cannot be made."""
    request = request or img_request
    h = img_hash(prompt)
    target = img_path(h, store)
    if os.path.exists(target):
        return target
    if not backend(options):
        raise LookupError(NO_BACKEND)
    with tts_locks_guard:
        lock = tts_locks.setdefault(f'img:{h}', threading.Lock())
    with lock, img_slots:
        if not os.path.exists(target):
            os.makedirs(os.path.dirname(target), exist_ok=True)
            try:
                image, _mime = request(prompt.strip(), options)
                to_jpg(image, target)
            except Exception as e:
                status['img_error'] = f'{time.strftime("%H:%M")} {str(e)[:300]}'
                raise
            status['img_made'] += 1
            status['img_error'] = None
    return target


SPRITE_MAX_CHARS = 2400


def sprite_hash(prompt, ref=''):
    """Matches js/media.js spriteUrl: SHA-1 of "sprite\n<ref>\n<prompt>", first 16 hex digits."""
    return hashlib.sha1(f'sprite\n{ref}\n{prompt.strip()}'.encode()).hexdigest()[:16]


def sprite_paths(h, store=STORE):
    """(the painted original, the cut-out with a transparent background).
    v3 = keyed from a green-backdrop edit of the original (<h>.green.jpg); v2 = cut_out of the original
    (the fallback when the green edit can't be made)."""
    base = os.path.join(store, 'sprite', h)
    return f'{base}.src.jpg', f'{base}.v3.webp'


# Asked for a green backdrop when painting a character, the model paints a textured grey one anyway;
# asked to EDIT a finished picture's backdrop to green, it does (tested 2026-11-15, Lavan and the shepherd).
GREEN_EDIT = ('Edit this picture. Keep the character exactly the same: same face, body, pose, clothing, colors, '
              'size and position in the frame. Replace everything around the character, including any shadow or '
              'glow, with a perfectly flat, solid, pure green (#00FF00) background with no texture, no gradient, '
              'no shadow and no outline around the figure.')


def green_key(im):
    """Transparent where the picture is clearly green (the characters wear no green), soft at the edge,
    and the green spill on the figure's rim taken out."""
    import numpy as np
    from PIL import Image, ImageFilter
    px = np.asarray(im.convert('RGB'), dtype=np.float32)
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    dom = g - np.maximum(r, b)
    alpha = np.clip((70 - dom) / 50, 0, 1) * 255
    a = Image.fromarray(alpha.astype(np.uint8)).filter(ImageFilter.MedianFilter(3))
    a = a.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    px[..., 1] = np.where(dom > 0, np.maximum(r, b), g)  # despill
    out = Image.fromarray(np.clip(px, 0, 255).astype(np.uint8)).convert('RGBA')
    out.putalpha(a)
    return out


def sprite_request(prompt, options, ref=None):
    """One character on flat green, as (image bytes, mime). With ref (jpg bytes) the
    model edits that picture, so a talking or blinking frame matches the base exactly."""
    model = options.get('img_model') or IMG_MODEL
    parts = [{'inlineData': {'mimeType': 'image/jpeg', 'data': base64.b64encode(ref).decode()}}] if ref else []
    parts.append({'text': prompt})
    body = {
        'contents': [{'role': 'user', 'parts': parts}],
        'generationConfig': {'responseModalities': ['TEXT', 'IMAGE'], 'imageConfig': {'aspectRatio': '3:4'}},
    }
    if backend(options) == 'vertex':
        found = find_image(post_json(vertex_url(options, model), body))
    else:
        req = urllib.request.Request(IMG_URL.format(model=model), data=json.dumps(body).encode(), method='POST',
                                     headers={'Content-Type': 'application/json',
                                              'x-goog-api-key': options.get('gemini_api_key') or ''})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                found = find_image(json.load(r))
        except urllib.error.HTTPError as e:
            raise ValueError(f'HTTP {e.code}: {e.read()[:300].decode(errors="replace")}') from e
    if not found:
        raise ValueError('no image in the response')
    return base64.b64decode(found[0]), found[1]


def cut_out(im, local=6.0, glob=42.0):
    """The figure with a transparent background. The model paints its characters on a plain backdrop
    (asked for green, it usually paints a textured grey). A region grows from the picture's border
    through pixels that change only gently from their neighbour (it follows texture and a vignette, the
    figure's outline stops it) and stay near the border's colour. Flat backdrop-coloured pockets closed
    in by the figure, and the soft grey shadow under the feet, go too (the player draws its own)."""
    import numpy as np
    from PIL import Image, ImageFilter
    rgb = im.convert('RGB')
    px = np.asarray(rgb.filter(ImageFilter.GaussianBlur(1)), dtype=np.float32)
    h, w, _ = px.shape
    bg = np.median(np.concatenate([px[0], px[-1], px[:, 0], px[:, -1]]), axis=0)
    dist = np.linalg.norm(px - bg, axis=2)
    chroma = px.max(axis=2) - px.min(axis=2)
    lum = px.mean(axis=2)
    low = np.arange(h)[:, None] > h * 0.7
    shadow = (chroma < 27) & (lum < bg.mean() + 4) & (lum > bg.mean() - 90) & low
    near = (dist < glob) | shadow
    reach = np.zeros((h, w), bool)
    reach[0, :] = reach[-1, :] = reach[:, 0] = reach[:, -1] = True
    reach &= near
    g = np.asarray(rgb.convert('L').filter(ImageFilter.GaussianBlur(1)), dtype=np.float32)
    m = np.asarray(Image.fromarray(g.astype(np.uint8)).filter(ImageFilter.BoxBlur(5)), dtype=np.float32)
    sq = Image.fromarray(np.clip(g * g / 255, 0, 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(5))
    std = np.sqrt(np.clip(np.asarray(sq, dtype=np.float32) * 255 - m * m, 0, None))
    reach |= ((dist < 14) & (std < 5)) | shadow
    dv = np.linalg.norm(px[1:] - px[:-1], axis=2) < local
    dh = np.linalg.norm(px[:, 1:] - px[:, :-1], axis=2) < local
    for _ in range(5000):
        grow = reach.copy()
        grow[1:] |= reach[:-1] & dv
        grow[:-1] |= reach[1:] & dv
        grow[:, 1:] |= reach[:, :-1] & dh
        grow[:, :-1] |= reach[:, 1:] & dh
        grow &= near
        if np.array_equal(grow, reach):
            break
        reach = grow
    alpha = Image.fromarray(np.where(reach, 0, 255).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def save_jpg(image, target):
    tmp = f'{target}.part.jpg'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', 'pipe:0', '-vf', 'scale=-2:1024', '-q:v', '3', tmp],
                   input=image, check=True, timeout=60, capture_output=True)
    os.replace(tmp, target)


def to_sprite(picture, out, key):
    """The picture (a jpg path) keyed by key() into a 900-high transparent webp."""
    from PIL import Image
    with Image.open(picture) as im:
        im = im.convert('RGB')
        im = im.resize((round(im.width * 900 / im.height), 900), Image.LANCZOS)
        tmp = f'{out}.part.webp'
        key(im).save(tmp, 'WEBP', quality=85, method=4)
    os.replace(tmp, out)


def sprite_file(prompt, options, store=STORE, ref='', request=None):
    """The cut-out for one character frame, painted on first use: the frame (an edit of its ref frame's
    original, if any), then a green-backdrop edit of it, keyed. Raises when it cannot be made;
    FileNotFoundError when the base frame (ref) has not been painted yet."""
    request = request or sprite_request
    h = sprite_hash(prompt, ref)
    src, out = sprite_paths(h, store)
    if os.path.exists(out):
        return out
    green = src.replace('.src.jpg', '.green.jpg')
    fallback = src.replace('.src.jpg', '.v2.webp')
    if not os.path.exists(src):
        ref_bytes = None
        if ref:
            ref_src = sprite_paths(ref, store)[0]
            if not os.path.exists(ref_src):
                raise FileNotFoundError('the base frame is not painted yet')
            with open(ref_src, 'rb') as f:
                ref_bytes = f.read()
        if not backend(options):
            raise LookupError(NO_BACKEND)
    with tts_locks_guard:
        lock = tts_locks.setdefault(f'sprite:{h}', threading.Lock())
    with lock, img_slots:
        if os.path.exists(out):
            return out
        os.makedirs(os.path.dirname(out), exist_ok=True)
        try:
            if not os.path.exists(src):
                image, _mime = request(prompt.strip(), options, ref_bytes)
                save_jpg(image, src)
                status['img_made'] += 1
            if not os.path.exists(green):
                if not backend(options):
                    raise LookupError(NO_BACKEND)
                with open(src, 'rb') as f:
                    image, _mime = request(GREEN_EDIT, options, f.read())
                save_jpg(image, green)
                status['img_made'] += 1
            to_sprite(green, out, green_key)
            status['img_error'] = None
        except Exception as e:
            status['img_error'] = f'{time.strftime("%H:%M")} sprite {str(e)[:300]}'
            if not os.path.exists(src):
                raise
            if not os.path.exists(fallback):  # keyed from the grey original until the green edit works
                to_sprite(src, fallback, cut_out)
            return fallback
    return out


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
                            + (f", last error {status['tts_error']}" if status['tts_error'] else '')
                            + f"; pictures: {status['img_made']} made since start"
                            + (f", last error {status['img_error']}" if status['img_error'] else '')
                            + f"; billing: {backend(self.options) or 'off (no vertex_api_key)'}")
            return
        t = re.fullmatch(r'/tts/([0-9a-f]{16})\.mp3', path)
        if t:
            self.tts(t.group(1), params)
            return
        sp = re.fullmatch(r'/sprite/([0-9a-f]{16})\.webp', path)
        if sp:
            self.sprite(sp.group(1), params)
            return
        i = re.fullmatch(r'/img/([0-9a-f]{16})\.jpg', path)
        if i:
            self.img(i.group(1), params)
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
        """/tts/<hash>.mp3?k=&l=en|he&t=<text>[&v=<voice>&s=<style>][&warm=1]: the line in a natural voice."""
        if params.get('k') not in self.keys:
            self.plain(403, 'this device is not in the family')
            return
        lang = params.get('l', '')
        text = urllib.parse.unquote_plus(params.get('t', '')).strip()
        voice = urllib.parse.unquote_plus(params.get('v', '')).strip()
        style = urllib.parse.unquote_plus(params.get('s', '')).strip()
        if (lang not in ('en', 'he') or not text or len(text) > TTS_MAX_CHARS or len(style) > 400
                or (voice and not re.fullmatch(r'[A-Za-z]{2,24}', voice)) or tts_hash(lang, text, voice, style) != h):
            self.plain(400, 'bad line')
            return
        try:
            file = tts_file(text, lang, self.options, self.store, voice=voice, style=style)
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

    def img(self, h, params):
        """/img/<hash>.jpg?k=&p=<prompt>[&warm=1]: the illustration, painted once."""
        if params.get('k') not in self.keys:
            self.plain(403, 'this device is not in the family')
            return
        prompt = urllib.parse.unquote_plus(params.get('p', '')).strip()
        if not prompt or len(prompt) > IMG_MAX_CHARS or img_hash(prompt) != h:
            self.plain(400, 'bad picture')
            return
        try:
            file = img_file(prompt, self.options, self.store)
        except LookupError as e:
            self.plain(404, str(e))
            return
        except Exception:  # the film shows its painted backdrop instead
            self.plain(503, 'could not paint the picture now')
            return
        if params.get('warm'):
            self.plain(200, 'ok')
            return
        self.send_file(file, 'image/jpeg', 'public, max-age=31536000, immutable')

    def sprite(self, h, params):
        """/sprite/<hash>.webp?k=&p=<prompt>[&r=<base hash>][&warm=1]: a character frame, cut out of its background."""
        if params.get('k') not in self.keys:
            self.plain(403, 'this device is not in the family')
            return
        prompt = urllib.parse.unquote_plus(params.get('p', '')).strip()
        ref = params.get('r', '')
        if (not prompt or len(prompt) > SPRITE_MAX_CHARS or (ref and not re.fullmatch(r'[0-9a-f]{16}', ref))
                or sprite_hash(prompt, ref) != h):
            self.plain(400, 'bad sprite')
            return
        try:
            file = sprite_file(prompt, self.options, self.store, ref)
        except FileNotFoundError as e:
            self.plain(409, str(e))
            return
        except LookupError as e:
            self.plain(404, str(e))
            return
        except Exception:  # the film plays on without that character's frame
            self.plain(503, 'could not paint the character now')
            return
        if params.get('warm'):
            self.plain(200, 'ok')
            return
        cache = 'no-cache' if file.endswith('.v2.webp') else 'public, max-age=31536000, immutable'
        self.send_file(file, 'image/webp', cache)

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
