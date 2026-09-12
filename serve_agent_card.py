import http.server
import socketserver
import os

PORT = 18084
DIRECTORY = os.path.expanduser("~/.cletus")

class MyHttpRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path == '/agent-card.json':
            self.path = 'agent-card.json'
            return super().do_GET()
        else:
            self.send_error(404, "File not found")

with socketserver.TCPServer(("", PORT), MyHttpRequestHandler) as httpd:
    print(f"Serving agent-card.json on port {PORT}")
    httpd.serve_forever()