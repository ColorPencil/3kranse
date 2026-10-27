import { createGuestbookHandler, guestbookConfig } from '../server/guestbook.mjs';
import { contentSecurityPolicy } from '../server/security.mjs';

// One handler per environment retains its local throttle between requests in this isolate.
// The D1 write also checks the per-IP limit globally across Cloudflare isolates.
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
      // request.cf is edge-provided metadata; client headers and browser language cannot assert a country.
      return handlers.get(env)(request, { ip, country: request.cf?.country });
    }
    if (/^\/ko(?:\/|$)/.test(url.pathname)) {
      // Request the clean directory URL so Pages does not redirect index.html before we set 404.
      const page = await env.ASSETS.fetch(new Request(new URL('/ko/', url), { method: 'GET' }));
      const headers = new Headers(page.headers);
      headers.set('Cache-Control', 'no-cache');
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      headers.set('Content-Security-Policy', contentSecurityPolicy);
      return new Response(request.method === 'HEAD' ? null : page.body, { status: 404, headers });
    }
    return env.ASSETS.fetch(request);
  },
};
