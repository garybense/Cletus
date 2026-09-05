#!/usr/bin/env python3
"""
Simple HTTP health-check responder for Entelechy nodes.
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        status = {"status": "online", "identity": "entelechy-node-01"}
        self.wfile.write(json.dumps(status).encode())

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 18080), HealthHandler)
    print("Health check server running on port 18080...")
    server.serve_forever()
