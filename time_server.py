import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone

class TimeHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/time':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            current_time = datetime.now(timezone.utc).isoformat()
            response = {"time": current_time}
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'Not Found')

    def log_message(self, format, *args):
        # Suppress log messages
        return

if __name__ == '__main__':
    port = 18081
    server_address = ('', port)
    httpd = HTTPServer(server_address, TimeHandler)
    print(f'Serving on port {port}')
    httpd.serve_forever()