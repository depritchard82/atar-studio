"""Local static preview with explicit JavaScript MIME types on Windows."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      '.mjs': 'text/javascript', '.js': 'text/javascript',
                      '.json': 'application/json', '.css': 'text/css'}

    def do_GET(self):
        # Avoid retaining an older Windows MIME type during local development.
        if 'If-Modified-Since' in self.headers:
            del self.headers['If-Modified-Since']
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    root = Path(__file__).resolve().parent.parent / 'dist'
    ThreadingHTTPServer(('127.0.0.1', 8765), partial(Handler, directory=str(root))).serve_forever()
