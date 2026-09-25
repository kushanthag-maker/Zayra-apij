// Local dev server: serves /public and forwards /api/* to the same handler used on Vercel.
const http = require('http');
const fs = require('fs');
const path = require('path');
const handler = require('./lib/app');
const PORT = process.env.PORT || 3000;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  if (req.url.startsWith('/f/')) { req.url = '/api/files/download/' + req.url.slice(3).split('?')[0]; return handler(req, res); }
  if (req.url.startsWith('/api')) return handler(req, res);
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(__dirname, 'public', path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(PORT, () => console.log(`ZAYRA API HUB running → http://localhost:${PORT}`));
