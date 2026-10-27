import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { render } from '../.render/entry-server.js';

try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const dist = path.resolve('dist/client');
const template = readFileSync(path.join(dist, 'index.html'), 'utf8');
const catalogue = JSON.parse(readFileSync('src/generated/catalogue.json', 'utf8'));
const entries = JSON.parse(readFileSync('src/generated/content.json', 'utf8'));
const routes = ['/', '/ko/'];
const langs = ['ja', 'zh-cn', 'en'];
for (const lang of langs) {
  for (const suffix of ['', 'guides/', 'data/', 'data/officers/', 'data/equipment/', 'data/controls/', 'creators/', 'devlog/', 'guestbook/', 'privacy/', '404/']) routes.push(`/${lang}/${suffix}`);
  for (const hero of catalogue.officers) routes.push(`/${lang}/data/officers/${hero.id}/`);
  for (const entry of entries.filter(item => item.lang === lang && item.category !== 'manual')) routes.push(`/${lang}/${entry.category}/${entry.slug}/`);
}
const origin = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : '';
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
for (const route of routes) {
  const { html, route: info } = render(route);
  const description = info.article?.summary || (info.lang === 'en' ? 'A single-player Three Kingdoms strategy game by Wood Pencil Studio.' : info.lang === 'zh-cn' ? '木头铅笔制作的买断制单人三国策略游戏。经营城池、培养武将，书写自己的三国征途。' : '木頭鉛筆が制作する買い切り型・一人用三国志戦略シミュレーション。');
  const language = info.korean ? 'ko' : info.lang === 'zh-cn' ? 'zh-CN' : info.lang;
  let head = `<meta property="og:title" content="${escape(info.title)}" /><meta property="og:description" content="${escape(description)}" /><meta property="og:type" content="website" />`;
  if (!info.valid) head += '<meta name="robots" content="noindex,follow" />';
  if (origin && info.valid) {
    const canonical = route === '/' ? '/ja/' : route;
    head += `<link rel="canonical" href="${origin}${canonical}" /><meta property="og:url" content="${origin}${canonical}" /><meta property="og:image" content="${origin}/assets/hero-global.webp" />`;
    for (const lang of langs) head += `<link rel="alternate" hreflang="${lang === 'zh-cn' ? 'zh-CN' : lang}" href="${origin}${canonical.replace(/^\/(ja|zh-cn|en)\//, `/${lang}/`)}" />`;
  }
  const page = template.replace('lang="ja"', `lang="${language}"`).replace(/<title>.*?<\/title>/, `<title>${escape(info.title)}</title>`).replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escape(description)}" />`).replace('</head>', `${head}</head>`).replace('<!--app-->', html);
  const target = path.join(dist, route, 'index.html');
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, page);
}
writeFileSync(path.join(dist, '404.html'), readFileSync(path.join(dist, 'ja/404/index.html')));
writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}`);
if (origin) writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.filter(route => route !== '/' && route !== '/ko/' && !route.includes('/404/')).map(route => `<url><loc>${origin}${route}</loc></url>`).join('')}</urlset>`);
console.log(`Prerendered ${routes.length} routes. Canonical URLs ${origin ? 'enabled' : 'await SITE_URL'}.`);
