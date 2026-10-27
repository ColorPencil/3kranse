import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareCloudflareAssets } from './prepare-cloudflare-assets.mjs';

const output = path.resolve('dist/client');
await prepareCloudflareAssets(output);
// Rebuilding either target must never expose the Pages server bundle as a public static file.
await writeFile(path.join(output, '.assetsignore'), `_worker.js
_routes.json
.env*
.dev.vars*
wrangler.*
`);
console.log('Cloudflare Workers ready: dist/client + wrangler.jsonc (shared guestbook and Korean 404 handler).');
