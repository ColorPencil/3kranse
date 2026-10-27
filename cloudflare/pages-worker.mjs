import { createGuestbookHandler, guestbookConfig } from '../server/guestbook.mjs';

// One handler per environment retains its local throttle between requests in this isolate.
// The author's backend must still enforce a global limit across all Cloudflare isolates.
const handlers = new WeakMap();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/guestbook/')) {
      if (!handlers.has(env)) {
        const config = guestbookConfig(env);
        // Previews and custom domains must validate against their own request origin.
        // SITE_URL remains the canonical SEO URL, not an exception to the same-origin rule.
        config.publicOrigin = '';
        handlers.set(env, createGuestbookHandler(config));
      }
      // This adapter runs exclusively at Cloudflare's edge. Never trust X-Forwarded-For or JSON IPs.
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      return handlers.get(env)(request, { ip });
    }
    if (/^\/ko(?:\/|$)/.test(url.pathname)) {
      // Request the clean directory URL so Pages does not redirect index.html before we set 404.
      const page = await env.ASSETS.fetch(new Request(new URL('/ko/', url), { method: 'GET' }));
      const headers = new Headers(page.headers);
      headers.set('Cache-Control', 'no-cache');
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; media-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
      return new Response(request.method === 'HEAD' ? null : page.body, { status: 404, headers });
    }
    return env.ASSETS.fetch(request);
  },
};
