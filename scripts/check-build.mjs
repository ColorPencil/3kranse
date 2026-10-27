import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve('dist/client');
const files = [];
function walk(dir) { for (const item of readdirSync(dir)) { const target = path.join(dir, item); if (statSync(target).isDirectory()) walk(target); else if (target.endsWith('.html')) files.push(target); } }
walk(root);
let references = 0;
for (const file of files) {
  const html = readFileSync(file, 'utf8');
  assert.ok(!html.includes('<!--app-->'), `Unrendered page: ${file}`);
  assert.ok(html.includes('<h1'), `No page heading: ${file}`);
  for (const [, attribute, url] of html.matchAll(/(href|src)="([^"]+)"/g)) {
    if (!url.startsWith('/') || url.startsWith('//')) continue;
    const pathname = decodeURIComponent(url.split(/[?#]/)[0]);
    const target = path.join(root, pathname, path.extname(pathname) ? '' : 'index.html');
    assert.ok(existsSync(target), `Broken ${attribute}: ${url} in ${file}`);
    references += 1;
  }
}
assert.ok(files.length >= 308);
console.log(`Verified ${files.length} rendered documents and ${references} internal links/assets.`);
