import { build } from 'vite';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareCloudflareAssets } from './prepare-cloudflare-assets.mjs';

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
await prepareCloudflareAssets(output);
console.log('Cloudflare Pages ready: dist/client (static site + guestbook Worker, no credentials embedded).');
