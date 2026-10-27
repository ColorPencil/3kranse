import { copyFile, writeFile } from 'node:fs/promises';

// Both hosting targets use the same static output, localized 404s and response headers.
export async function prepareCloudflareAssets(output) {
  for (const lang of ['ja', 'zh-cn', 'en']) {
    await copyFile(`${output}/${lang}/404/index.html`, `${output}/${lang}/404.html`);
  }
  await writeFile(`${output}/_headers`, `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; media-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
/assets/*
  Cache-Control: public, max-age=3600
`);
}
