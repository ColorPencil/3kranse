import { build } from 'vite';
import { copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('dist/client');
// Preserve the prerendered site; only bundle the portable server handler for Pages advanced mode.
await build({
  configFile: false,
  publicDir: false,
  build: {
    outDir: output,
    emptyOutDir: false,
    target: 'es2022',
    lib: { entry: path.resolve('cloudflare/pages-worker.mjs'), formats: ['es'], fileName: () => '_worker.js' },
  },
});
await writeFile(path.join(output, '_routes.json'), JSON.stringify({
  version: 1,
  include: ['/api/guestbook/*', '/ko', '/ko/*'],
  exclude: ['/assets/*'],
}, null, 2) + '\n');
for (const lang of ['ja', 'zh-cn', 'en']) {
  // Pages chooses the nearest 404.html instead of turning unknown URLs into SPA successes.
  await copyFile(path.join(output, lang, '404/index.html'), path.join(output, lang, '404.html'));
}
await writeFile(path.join(output, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; media-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
/assets/*
  Cache-Control: public, max-age=3600
`);
console.log('Cloudflare Pages ready: dist/client (static site + guestbook Worker, no credentials embedded).');
