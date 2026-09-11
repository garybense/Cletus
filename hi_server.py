#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HiHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        logger.info(f"Received request for path: {self.path}")
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'I have stopped saying Hi as requested.')

    def log_message(self, format, *args):
        logger.info("%s - - [%s] %s" %
                    (self.address_string(),
                     self.log_date_time_string(),
                     format%args))

if __name__ == '__main__':
    PORT = 18083
    logger.info(f"Starting server on port {PORT}")
    server = HTTPServer(('0.0.0.0', PORT), HiHandler)
    logger.info(f"Server running on port {PORT}")
    server.serve_forever()