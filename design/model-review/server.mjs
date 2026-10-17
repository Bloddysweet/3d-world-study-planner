import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stat, readFile } from 'node:fs/promises';
const root = path.dirname(fileURLToPath(import.meta.url));
const models = path.resolve(root, '../../public/models');
const originals = path.resolve(root, '../../assets/blender/exports-original');
const candidate = path.resolve(root, '../../.cache/model-optimization/staged');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.glb': 'model/gltf-binary' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://review.local').pathname);
    let base = root, relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (pathname.startsWith('/original-models/')) { base = originals; relative = pathname.slice('/original-models/'.length); }
    else if (pathname.startsWith('/candidate-models/')) { base = candidate; relative = pathname.slice('/candidate-models/'.length); }
    else if (pathname.startsWith('/models/')) { base = models; relative = pathname.slice(8); }
    else if (pathname.startsWith('/vendor/three/')) { base = path.join(root, 'node_modules/three'); relative = pathname.slice(14); }
    else if (!['index.html', 'review.js', 'styles.css', 'validation-results.json'].includes(relative)) {
      res.writeHead(404); return res.end('Not found');
    }
    const filename = path.resolve(base, relative);
    if (!filename.startsWith(path.resolve(base) + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    if (!(await stat(filename)).isFile()) { res.writeHead(404); return res.end('Not found'); }
    const data = await readFile(filename);
    res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(Number(process.env.PORT || 4173), '0.0.0.0', () => console.log('Model review listening on 0.0.0.0:' + server.address().port));
