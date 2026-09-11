const http = require('http');
const port = process.env.PORT || 18081;

const server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('hi');
  } else {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Method not allowed');
  }
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});