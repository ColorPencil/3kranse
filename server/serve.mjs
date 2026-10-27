import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { createGuestbookHandler, guestbookConfig } from './guestbook.mjs';
import { toWebRequest, sendWebResponse } from './node-adapter.mjs';
import { clientIP } from './client-ip.mjs';

try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const root = path.resolve('dist/client');
const api = createGuestbookHandler(guestbookConfig(process.env));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.mp4': 'video/mp4', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml', '.txt': 'text/plain' };
http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/guestbook/')) {
      const request = toWebRequest(req);
      return await sendWebResponse(res, await api(request, { ip: clientIP(req, process.env.TRUST_PROXY_IPS) }));
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    let status = 200;
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      await stat(file);
    } catch {
      const locale = /^\/(ja|zh-cn|en|ko)(?:\/|$)/.exec(pathname)?.[1];
      file = locale === 'ko' ? path.join(root, 'ko/index.html') : locale ? path.join(root, locale, '404/index.html') : path.join(root, '404.html');
      status = 404;
    }
    if (/^\/ko(?:\/|$)/.test(pathname)) status = 404;
    const data = await readFile(file);
    res.writeHead(status, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; media-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
      'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(500); res.end('Server error'); }
}).listen(Number(process.env.PORT) || 4173, '0.0.0.0', () => console.log(`Official site ready at http://localhost:${process.env.PORT || 4173}`));
