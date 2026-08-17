import os
import sys
import json
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler

# Add root project dir to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from server.db import init_db
from server.api_handler import handle_api_request

PORT = 3000
PUBLIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'public'))

class BudgetAppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_HEAD(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path.startswith('/api/'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
        else:
            super().do_HEAD()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path.startswith('/api/'):
            query_params = dict(urllib.parse.parse_qsl(parsed_url.query))
            res = handle_api_request('GET', parsed_url.path, {}, query_params)
            self._send_api_response(res)
        else:
            filepath = os.path.join(PUBLIC_DIR, parsed_url.path.lstrip('/'))
            if not os.path.exists(filepath) or os.path.isdir(filepath):
                self.path = '/index.html'
            super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path.startswith('/api/'):
            body = self._read_json_body()
            query_params = dict(urllib.parse.parse_qsl(parsed_url.query))
            res = handle_api_request('POST', parsed_url.path, body, query_params)
            self._send_api_response(res)
        else:
            self.send_error(405, "Method Not Allowed")

    def do_PUT(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path.startswith('/api/'):
            body = self._read_json_body()
            query_params = dict(urllib.parse.parse_qsl(parsed_url.query))
            res = handle_api_request('PUT', parsed_url.path, body, query_params)
            self._send_api_response(res)
        else:
            self.send_error(405, "Method Not Allowed")

    def do_DELETE(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path.startswith('/api/'):
            query_params = dict(urllib.parse.parse_qsl(parsed_url.query))
            res = handle_api_request('DELETE', parsed_url.path, {}, query_params)
            self._send_api_response(res)
        else:
            self.send_error(405, "Method Not Allowed")

    def _read_json_body(self):
        content_len = int(self.headers.get('Content-Length', 0))
        if content_len > 0:
            body_bytes = self.rfile.read(content_len)
            try:
                return json.loads(body_bytes.decode('utf-8'))
            except Exception:
                return {}
        return {}

    def _send_api_response(self, res):
        status = res.get('status', 200)
        content_type = res.get('content_type', 'application/json')
        
        self.send_response(status)
        self.send_header('Content-Type', f'{content_type}; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

        if content_type == 'text/csv':
            raw_data = res.get('raw', '').encode('utf-8')
            self.send_header('Content-Disposition', 'attachment; filename="transactions.csv"')
            self.send_header('Content-Length', str(len(raw_data)))
            self.end_headers()
            self.wfile.write(raw_data)
        else:
            payload = json.dumps(res.get('data', {})).encode('utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def run_server():
    print("Initializing Database...")
    init_db()
    server = HTTPServer(('0.0.0.0', PORT), BudgetAppHandler)
    print(f"BudgetApp Server running at http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        server.server_close()

if __name__ == '__main__':
    run_server()
