import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone

class TimeHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/time':
            # Get current UTC time in ISO 8601 format
            current_time = datetime.now(timezone.utc).isoformat()
            response = {"time": current_time}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')

def run_server():
    port = int(os.environ.get('PORT', 18080))
    server_address = ('', port)
    httpd = HTTPServer(server_address, TimeHandler)
    print(f'Server running on port {port}')
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()