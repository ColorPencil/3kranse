import { languages } from '../src/locale.mjs';
import { contentSecurityPolicy } from '../server/security.mjs';
import { copyFile, writeFile } from 'node:fs/promises';

// Both hosting targets use the same static output, localized 404s and response headers.
export async function prepareCloudflareAssets(output) {
  for (const lang of languages) {
    await copyFile(output + '/' + lang + '/404/index.html', output + '/' + lang + '/404.html');
  }
  await writeFile(output + '/_headers', [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Content-Security-Policy: ' + contentSecurityPolicy,
    '/assets/*',
    '  Cache-Control: public, max-age=3600', '',
  ].join('\n'));
}
