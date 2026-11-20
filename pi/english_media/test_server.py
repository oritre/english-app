"""python3 -m unittest pi/english_media/test_server.py"""
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(__file__))
import server  # noqa: E402


class KeyTest(unittest.TestCase):
    def test_key_matches_the_app(self):
        # js/media.js: SHA-256("media:" + code), first 16 hex digits
        self.assertEqual(server.media_key('abcd-2345'), server.media_key('ABCD2345'))
        self.assertEqual(len(server.media_key('ABCD2345')), 16)
        self.assertIsNone(server.media_key(''))
        self.assertEqual(len(server.keys_from({'family_code': 'ABCD2345, WXYZ6789'})), 2)

    def test_range(self):
        self.assertEqual(server.parse_range('bytes=0-', 100), (0, 99))
        self.assertEqual(server.parse_range('bytes=10-19', 100), (10, 19))
        self.assertEqual(server.parse_range('bytes=-10', 100), (90, 99))
        self.assertEqual(server.parse_range('bytes=50-500', 100), (50, 99))
        self.assertIsNone(server.parse_range('bytes=200-', 100))
        self.assertIsNone(server.parse_range(None, 100))


class ServeTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        with open(os.path.join(self.dir, 'Fhg_VfSyi5I.mp4'), 'wb') as f:
            f.write(bytes(range(256)) * 4)
        handler = type('H', (server.Handler,), {'keys': {server.media_key('ABCD2345')}, 'store': self.dir})
        self.httpd = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.base = f'http://127.0.0.1:{self.httpd.server_port}'

    def tearDown(self):
        self.httpd.shutdown()

    def get(self, path, headers=None):
        try:
            with urllib.request.urlopen(urllib.request.Request(self.base + path, headers=headers or {})) as r:
                return r.status, r.read(), r.headers
        except urllib.error.HTTPError as e:
            return e.code, e.read(), e.headers

    def test_needs_the_family_key(self):
        self.assertEqual(self.get('/v/Fhg_VfSyi5I.mp4')[0], 403)
        self.assertEqual(self.get('/v/Fhg_VfSyi5I.mp4?k=0000000000000000')[0], 403)
        code, body, headers = self.get(f"/v/Fhg_VfSyi5I.mp4?k={server.media_key('ABCD2345')}")
        self.assertEqual((code, len(body), headers['Content-Type']), (200, 1024, 'video/mp4'))

    def test_range_request(self):
        code, body, headers = self.get(f"/v/Fhg_VfSyi5I.mp4?k={server.media_key('ABCD2345')}", {'Range': 'bytes=256-511'})
        self.assertEqual((code, body, headers['Content-Range']), (206, bytes(range(256)), 'bytes 256-511/1024'))

    def test_missing_and_bad_paths(self):
        k = server.media_key('ABCD2345')
        self.assertEqual(self.get(f'/v/aaaaaaaaaaa.mp4?k={k}')[0], 404)
        self.assertEqual(self.get(f'/v/../../etc/passwd?k={k}')[0], 404)
        self.assertEqual(self.get('/status')[0], 200)



def fake_wav(seconds=0.3):
    import io
    import wave
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(b'\x00\x10' * int(24000 * seconds))
    return buf.getvalue()


class VoiceTest(unittest.TestCase):
    def test_hash_matches_the_app(self):
        # js/speech.js: SHA-1 of "en\nHello!", first 16 hex digits
        import hashlib
        self.assertEqual(server.tts_hash('en', ' Hello! '), hashlib.sha1(b'en\nHello!').hexdigest()[:16])
        self.assertNotEqual(server.tts_hash('en', 'Hi'), server.tts_hash('he', 'Hi'))

    def test_finds_the_audio(self):
        data = 'A' * 200
        interactions = {'steps': [{'content': [{'type': 'text', 'text': 'x'}, {'type': 'audio', 'data': data, 'mime_type': 'audio/wav'}]}]}
        generate = {'candidates': [{'content': {'parts': [{'inlineData': {'mimeType': 'audio/L16;rate=24000', 'data': data}}]}}]}
        self.assertEqual(server.find_audio(interactions), (data, 'audio/wav'))
        self.assertEqual(server.find_audio(generate), (data, 'audio/L16;rate=24000'))
        self.assertIsNone(server.find_audio({'steps': [{'content': [{'type': 'text', 'text': 'no audio'}]}]}))

    def test_makes_once_and_keeps(self):
        store = tempfile.mkdtemp()
        calls = []
        def request(text, options):
            calls.append(text)
            return fake_wav(), 'audio/wav'
        with self.assertRaises(LookupError):
            server.tts_file('Hello', 'en', {}, store, request)
        a = server.tts_file(' Hello ', 'en', {'vertex_api_key': 'x'}, store, request)
        b = server.tts_file('Hello', 'en', {'vertex_api_key': 'x'}, store, request)
        self.assertEqual((a, calls), (b, ['Hello']))
        with open(a, 'rb') as f:
            head = f.read(3)
        self.assertTrue(head == b'ID3' or head[0] == 0xFF)
        # raw PCM too
        raw = server.tts_file('Raw', 'en', {'vertex_api_key': 'x'}, store, lambda t, o: (b'\x00\x10' * 4800, 'audio/L16;rate=24000'))
        self.assertGreater(os.path.getsize(raw), 100)


class VoiceServeTest(ServeTest):
    def setUp(self):
        super().setUp()
        self.made = []
        def request(text, options):
            self.made.append(text)
            if text == 'fail':
                raise OSError('quota')
            return fake_wav(), 'audio/wav'
        self.orig = server.tts_request
        server.tts_request = request
        self.httpd.RequestHandlerClass.options = {'vertex_api_key': 'x'}

    def tearDown(self):
        server.tts_request = self.orig
        super().tearDown()

    def url(self, text, lang='en', key=None, extra=''):
        import urllib.parse
        k = key or server.media_key('ABCD2345')
        return f'/tts/{server.tts_hash(lang, text)}.mp3?k={k}&l={lang}&t={urllib.parse.quote(text)}{extra}'

    def test_voice(self):
        line = 'Good morning, Re\'i! 1+1=2 & more'
        self.assertEqual(self.get(self.url(line, key='0000000000000000'))[0], 403)
        self.assertEqual(self.get(self.url(line).replace('l=en', 'l=fr'))[0], 400)
        self.assertEqual(self.get(self.url(line).replace('t=', 't=x'))[0], 400)
        self.assertEqual(self.get(self.url(line, extra='&warm=1'))[:2], (200, b'ok'))
        code, body, headers = self.get(self.url(line))
        self.assertEqual((code, headers['Content-Type']), (200, 'audio/mpeg'))
        self.assertIn('immutable', headers['Cache-Control'])
        self.assertEqual(self.made, [line])
        self.assertEqual(self.get(self.url('שלום', 'he'))[0], 200)
        self.assertEqual(self.get(self.url('fail'))[0], 503)
        self.assertIn('quota', self.get('/status')[1].decode())
        self.httpd.RequestHandlerClass.options = {}
        self.assertEqual(self.get(self.url('no key yet'))[0], 404)


class BillingTest(unittest.TestCase):
    def test_paid_key_is_not_used_unless_allowed(self):
        self.assertIsNone(server.backend({'gemini_api_key': 'paid'}))
        self.assertEqual(server.backend({'gemini_api_key': 'paid', 'allow_paid_key': True}), 'paid')
        self.assertEqual(server.backend({'gemini_api_key': 'paid', 'vertex_api_key': 'v'}), 'vertex')
        store = tempfile.mkdtemp()
        with self.assertRaises(LookupError):
            server.img_file('A tent', {'gemini_api_key': 'paid'}, store, lambda p, o: (fake_png(), 'image/png'))

    def test_vertex_address(self):
        url = server.vertex_url({'vertex_api_key': 'k', 'vertex_project': 'p1'}, 'gemini-2.5-flash-image')
        self.assertEqual(url, 'https://aiplatform.googleapis.com/v1/projects/p1/locations/global/publishers/google/models/gemini-2.5-flash-image:generateContent?key=k')
        self.assertTrue(server.vertex_url({'vertex_api_key': 'k', 'vertex_location': 'us-central1'}, 'm').startswith('https://us-central1-aiplatform.googleapis.com/'))


def fake_png():
    import subprocess
    return subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=64x36', '-frames:v', '1',
                           '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1'], check=True, capture_output=True).stdout


class PictureTest(unittest.TestCase):
    def test_hash_matches_the_app(self):
        import hashlib
        self.assertEqual(server.img_hash(' A field '), hashlib.sha1(b'img\nA field').hexdigest()[:16])

    def test_finds_the_image(self):
        data = 'B' * 200
        resp = {'candidates': [{'content': {'parts': [{'text': 'here'}, {'inlineData': {'mimeType': 'image/png', 'data': data}}]}}]}
        self.assertEqual(server.find_image(resp), (data, 'image/png'))
        self.assertIsNone(server.find_image({'candidates': [{'content': {'parts': [{'text': 'no'}]}}]}))

    def test_paints_once_and_keeps(self):
        store = tempfile.mkdtemp()
        calls = []
        def request(prompt, options):
            calls.append(prompt)
            return fake_png(), 'image/png'
        with self.assertRaises(LookupError):
            server.img_file('A well', {}, store, request)
        a = server.img_file(' A well ', {'vertex_api_key': 'x'}, store, request)
        b = server.img_file('A well', {'vertex_api_key': 'x'}, store, request)
        self.assertEqual((a, calls), (b, ['A well']))
        with open(a, 'rb') as f:
            self.assertEqual(f.read(2), b'\xff\xd8')


class PaintAheadTest(unittest.TestCase):
    def test_paints_missing_waits_after_429_and_skips_errors(self):
        store = tempfile.mkdtemp()
        opts = {'vertex_api_key': 'x'}
        tries, waits = [], []
        def request(prompt, options):
            tries.append(prompt)
            if prompt == 'busy' and tries.count('busy') < 3:
                raise ValueError('HTTP 429: RESOURCE_EXHAUSTED')
            if prompt == 'broken':
                raise ValueError('no image in the response')
            return fake_png(), 'image/png'
        paint = lambda p, o, st: server.img_file(p, o, st, request)
        server.img_file('kept', opts, store, request)
        made = server.paint_ahead(opts, store, ['kept', 'busy', 'broken', 'sea'], paint, waits.append, 0)
        self.assertEqual(made, 2)
        self.assertEqual(tries, ['kept', 'busy', 'busy', 'busy', 'broken', 'sea'])
        self.assertEqual([w for w in waits if w != server.PAINT_GAP_S], list(server.PAINT_BACKOFF_S[:2]))
        self.assertEqual((server.status['pictures'], server.status['pictures_ready']), (4, 3))

    def test_daily_limit_and_list_address(self):
        store = tempfile.mkdtemp()
        paint = lambda p, o, st: server.img_file(p, o, st, lambda *_: (fake_png(), 'image/png'))
        self.assertEqual(server.paint_ahead({'vertex_api_key': 'x'}, store, ['a', 'b', 'c'], paint, lambda _s: None, 2), 2)
        self.assertEqual(server.pictures_url({'videos_url': 'https://x.io/app/data/videos.json'}), 'https://x.io/app/data/pictures.json')


class PictureServeTest(ServeTest):
    def setUp(self):
        super().setUp()
        def request(prompt, options):
            if prompt == 'fail':
                raise OSError('no image quota')
            return fake_png(), 'image/png'
        self.orig = server.img_request
        server.img_request = request
        self.httpd.RequestHandlerClass.options = {'vertex_api_key': 'x'}

    def tearDown(self):
        server.img_request = self.orig
        super().tearDown()

    def url(self, prompt, key=None, extra=''):
        import urllib.parse
        k = key or server.media_key('ABCD2345')
        return f'/img/{server.img_hash(prompt)}.jpg?k={k}&p={urllib.parse.quote(prompt)}{extra}'

    def test_picture(self):
        prompt = 'Storybook painting: a well & sheep at dusk'
        self.assertEqual(self.get(self.url(prompt, key='0000000000000000'))[0], 403)
        self.assertEqual(self.get(self.url(prompt).replace('p=', 'p=x'))[0], 400)
        self.assertEqual(self.get(self.url(prompt, extra='&warm=1'))[:2], (200, b'ok'))
        code, body, headers = self.get(self.url(prompt))
        self.assertEqual((code, headers['Content-Type'], body[:2]), (200, 'image/jpeg', b'\xff\xd8'))
        self.assertEqual(self.get(self.url('fail'))[0], 503)
        self.assertIn('no image quota', self.get('/status')[1].decode())


class CharacterVoiceTest(unittest.TestCase):
    def test_hash_and_voice_reach_the_request(self):
        import hashlib
        self.assertEqual(server.tts_hash('he', ' שלום '), hashlib.sha1('he\nשלום'.encode()).hexdigest()[:16])
        self.assertEqual(server.tts_hash('he', 'שלום', 'Charon', 'calm'),
                         hashlib.sha1('he|Charon|calm\nשלום'.encode()).hexdigest()[:16])
        store = tempfile.mkdtemp()
        seen = []
        def request(text, options, voice='', style=''):
            seen.append((voice, style))
            return b'\0' * 4800, 'audio/L16;rate=24000'
        server.tts_file('שלום', 'he', {'vertex_api_key': 'x'}, store, request, voice='Charon', style='calm')
        server.tts_file('שלום', 'he', {'vertex_api_key': 'x'}, store, request)
        self.assertEqual(seen, [('Charon', 'calm'), ('', '')])


class SpriteTest(unittest.TestCase):
    def test_paints_base_then_edits_it(self):
        store = tempfile.mkdtemp()
        calls = []
        fail = []
        def request(prompt, options, ref=None):
            if prompt == server.GREEN_EDIT and fail:
                raise OSError('quota')
            calls.append(('green' if prompt == server.GREEN_EDIT else prompt, ref is not None))
            return fake_png(), 'image/png'
        opts = {'vertex_api_key': 'x'}
        base = server.sprite_hash('Yaakov standing')
        with self.assertRaises(FileNotFoundError):
            server.sprite_file('mouth open', opts, store, base, request)
        a = server.sprite_file('Yaakov standing', opts, store, '', request)
        self.assertTrue(a.endswith('.v4.webp') and os.path.exists(server.sprite_paths(base, store)[0]))
        server.sprite_file('Yaakov standing', opts, store, '', request)
        self.assertEqual(calls, [('Yaakov standing', False), ('green', True)])
        with open(a, 'rb') as f:
            self.assertEqual(f.read(12)[8:], b'WEBP')
        os.remove(a)  # an older cut: keyed again from the kept green picture, nothing painted
        server.sprite_file('Yaakov standing', opts, store, '', request)
        self.assertEqual(len(calls), 2)
        fail.append(1)  # the green edit fails: the frame is cut from its grey original meanwhile
        b = server.sprite_file('mouth open', opts, store, base, request)
        self.assertTrue(b.endswith('.v2.webp'))
        fail.clear()
        c = server.sprite_file('mouth open', opts, store, base, request)
        self.assertTrue(c.endswith('.v4.webp'))
        self.assertEqual(calls[2:], [('mouth open', True), ('green', True)])

    def test_green_key(self):
        from PIL import Image, ImageDraw
        im = Image.new('RGB', (300, 400), (20, 250, 30))
        d = ImageDraw.Draw(im)
        d.rectangle([100, 60, 200, 340], fill=(150, 90, 50))
        d.rectangle([20, 60, 30, 340], fill=(110, 70, 40))
        d.ellipse([90, 335, 210, 360], fill=(30, 110, 35))  # a green-tinted shadow
        out = server.green_key(im)
        a = out.getchannel('A')
        self.assertEqual((a.getpixel((5, 5)), a.getpixel((60, 200)), a.getpixel((150, 352))), (0, 0, 0))
        self.assertEqual((a.getpixel((150, 200)), a.getpixel((25, 200))), (255, 255))

    def test_green_key_follows_a_muted_textured_green(self):
        from PIL import Image, ImageDraw
        im = Image.new('RGB', (300, 400), (70, 150, 75))
        d = ImageDraw.Draw(im)
        for x in range(0, 300, 5):  # painted texture
            d.line([(x, 0), (x, 400)], fill=(80, 140, 82))
        d.ellipse([60, 20, 240, 380], fill=(105, 160, 108))  # a lighter glow behind the figure
        d.rectangle([100, 60, 200, 340], fill=(150, 90, 50))  # a robe
        d.rectangle([120, 20, 180, 58], fill=(185, 186, 182))  # a grey beard
        d.ellipse([90, 335, 210, 360], fill=(40, 90, 45))  # shadow
        a = server.green_key(im).getchannel('A')
        self.assertEqual((a.getpixel((5, 5)), a.getpixel((80, 200)), a.getpixel((150, 352))), (0, 0, 0))
        self.assertEqual((a.getpixel((150, 200)), a.getpixel((150, 35))), (255, 255))

    def test_cut_out_removes_a_grey_backdrop(self):
        from PIL import Image, ImageDraw
        im = Image.new('RGB', (300, 400), (128, 124, 120))
        d = ImageDraw.Draw(im)
        for x in range(0, 300, 6):  # painted texture
            d.line([(x, 0), (x, 400)], fill=(132, 127, 122))
        d.rectangle([100, 60, 200, 340], fill=(150, 90, 50), outline=(240, 200, 150), width=3)  # a robe
        d.rectangle([20, 60, 30, 340], fill=(110, 70, 40))  # a staff
        d.ellipse([90, 335, 210, 360], fill=(100, 97, 94))  # shadow under the feet
        a = server.cut_out(im).getchannel('A')
        self.assertEqual((a.getpixel((5, 5)), a.getpixel((60, 200)), a.getpixel((150, 352))), (0, 0, 0))
        self.assertEqual((a.getpixel((150, 200)), a.getpixel((25, 200))), (255, 255))


if __name__ == '__main__':
    unittest.main()
