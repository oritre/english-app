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
        a = server.tts_file(' Hello ', 'en', {'gemini_api_key': 'x'}, store, request)
        b = server.tts_file('Hello', 'en', {'gemini_api_key': 'x'}, store, request)
        self.assertEqual((a, calls), (b, ['Hello']))
        with open(a, 'rb') as f:
            head = f.read(3)
        self.assertTrue(head == b'ID3' or head[0] == 0xFF)
        # raw PCM too
        raw = server.tts_file('Raw', 'en', {'gemini_api_key': 'x'}, store, lambda t, o: (b'\x00\x10' * 4800, 'audio/L16;rate=24000'))
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
        self.httpd.RequestHandlerClass.options = {'gemini_api_key': 'x'}

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


if __name__ == '__main__':
    unittest.main()
