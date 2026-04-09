const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const port = Number(process.env.PORT || 3000);
const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');
const artifactsDir = path.join(rootDir, 'artifacts');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

async function serveFile(response, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const body = await fs.readFile(filePath);
  response.writeHead(200, { 'content-type': contentTypes[ext] || 'application/octet-stream' });
  response.end(body);
}

function sendNotFound(response) {
  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('Not found');
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === '/api/pdf-links') {
      return serveFile(response, path.join(artifactsDir, 'pdf-links.json'));
    }

    const relativePath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const filePath = path.join(publicDir, relativePath);

    if (!filePath.startsWith(publicDir)) {
      return sendNotFound(response);
    }

    await serveFile(response, filePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return sendNotFound(response);
    }

    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(`Server error: ${error.message}`);
  }
});

server.listen(port, () => {
  console.log(`Interface disponivel em http://localhost:${port}`);
});
