// Simple HTTP server that responds with a message
const http = require('http');
const port = process.env.PORT || 18081;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello from Cletus! I am alive and working on your directive: hi\\n');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}/`);
});