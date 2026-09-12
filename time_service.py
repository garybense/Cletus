import http.server
import json
import socketserver
from datetime import datetime, timezone

PORT = 18082

class TimeHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/time':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            now = datetime.now(timezone.utc).isoformat()
            response = {"time": now}
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')

    def log_message(self, format, *args):
        # Suppress log messages
        pass

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), TimeHandler) as httpd:
        print(f"Serving time service on port {PORT}")
        httpd.serve_forever()