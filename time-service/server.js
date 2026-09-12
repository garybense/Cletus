const http = require('http');
const port = process.env.PORT || 18082;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/time') {
    const now = new Date().toISOString();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ time: now }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(port, () => {
  console.log(`Time service running on port ${port}`);
});