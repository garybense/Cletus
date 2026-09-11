#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, HTTPServer

class HiHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'hi')

    def do_POST(self):
        self.do_GET()

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 18083), HiHandler)
    print('Server running on port 18083')
    server.serve_forever()