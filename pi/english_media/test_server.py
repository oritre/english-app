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


if __name__ == '__main__':
    unittest.main()
