#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load agent card
try:
    with open('/Users/user/.cletus/agent-card.json', 'r') as f:
        agent_card = json.load(f)
except FileNotFoundError:
    agent_card = {'error': 'Agent card not found'}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        logger.info(f"Received request for path: {self.path}")
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'hi - Server operational and modified.')
        elif self.path == '/agent-card.json':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(agent_card).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        logger.info("%s - - [%s] %s" %
                    (self.address_string(),
                     self.log_date_time_string(),
                     format%args))

if __name__ == '__main__':
    PORT = 18084
    logger.info(f"Starting server on port {PORT}")
    server = HTTPServer(('0.0.0.0', PORT), Handler)
    logger.info(f"Server running on port {PORT}")
    server.serve_forever()