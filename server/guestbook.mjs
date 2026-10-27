import { isVisitorId } from '../shared/visitor-id.mjs';
import { defaultNickname as makeDefaultNickname, publicNickname } from './guestbook-identity.mjs';
import { createD1Store, fingerprint, GuestbookStoreError } from './d1-store.mjs';

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
const failure = (code, status) => json({ error: { code } }, status);
const trim = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export function guestbookConfig(env = {}) {
  return {
    storage: env.GUESTBOOK_STORAGE || (env.D1_ACCOUNT_ID ? 'd1' : 'upstream'),
    d1: { accountId: env.D1_ACCOUNT_ID || '', databaseId: env.D1_DATABASE_ID || '', token: env.D1_API_TOKEN || '' },
    baseUrl: env.GUESTBOOK_API_BASE_URL || '', token: env.GUESTBOOK_API_TOKEN || '',
    captchaProvider: env.CAPTCHA_PROVIDER || (env.CAPTCHA_CHALLENGE_URL && env.CAPTCHA_VERIFY_URL ? 'image' : 'turnstile'),
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || '', turnstileSecretKey: env.TURNSTILE_SECRET_KEY || '',
    captchaChallengeUrl: env.CAPTCHA_CHALLENGE_URL || '', captchaVerifyUrl: env.CAPTCHA_VERIFY_URL || '',
    captchaToken: env.CAPTCHA_API_TOKEN || '', publicOrigin: env.SITE_URL || '',
  };
}

export function createGuestbookHandler(config, fetcher = fetch) {
  const attempts = new Map();
  const d1 = config.storage === 'd1' ? createD1Store(config.d1, fetcher) : null;
  const readable = d1 ? d1.configured : Boolean(config.baseUrl && config.token);
  const provider = config.captchaProvider || 'image';
  const captchaReady = provider === 'turnstile'
    ? Boolean(config.turnstileSiteKey && config.turnstileSecretKey)
    : Boolean(config.captchaChallengeUrl && config.captchaVerifyUrl && (config.captchaToken || config.token));
  // Public reading can work before CAPTCHA setup, but posting must never bypass verification.
  const configured = readable && captchaReady;
  async function upstream(url, payload, captcha = false) {
    const response = await fetcher(url, {
      method: payload ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + (captcha ? config.captchaToken || config.token : config.token), 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('UPSTREAM_UNAVAILABLE');
    return response.json();
  }
  return async function handle(request, context = {}) {
    const url = new URL(request.url);
    const route = url.pathname.replace(/\/$/, '');
    // Only the hosting adapter supplies the trusted IP; client JSON and forwarded headers are ignored.
    const ip = trim(context.ip, 80) || 'unknown';
    // This client ID is a display preference, not proof of identity or a substitute for IP throttling.
    const suppliedVisitorId = request.headers.get('x-guestbook-visitor');
    const visitorId = isVisitorId(suppliedVisitorId) ? suppliedVisitorId.toLowerCase() : crypto.randomUUID();
    const defaultNickname = makeDefaultNickname(visitorId, context.country);
    if (route === '/api/guestbook/status' && request.method === 'GET') {
      return json({ available: configured, readable, defaultNickname, captchaRequired: true, captchaProvider: provider, turnstileSiteKey: provider === 'turnstile' ? config.turnstileSiteKey || '' : '' });
    }
    try {
      if (route === '/api/guestbook/messages' && request.method === 'GET') {
        if (!readable) return failure('NOT_CONFIGURED', 503);
        const cursor = trim(url.searchParams.get('cursor'), 200);
        if (d1) return json(await d1.list(cursor));
        const target = new URL('v1/messages', config.baseUrl.endsWith('/') ? config.baseUrl : config.baseUrl + '/');
        target.searchParams.set('limit', '12');
        if (cursor) target.searchParams.set('cursor', cursor);
        const data = await upstream(target);
        const items = (Array.isArray(data.items) ? data.items : []).slice(0, 12).map(item => ({
          id: trim(item.id, 100), nickname: publicNickname(item.nickname, { legacyId: trim(item.id, 100) }), content: trim(item.content, 2000), createdAt: trim(item.createdAt, 40),
        }));
        return json({ items, nextCursor: trim(data.nextCursor, 200) || null });
      }
      if (!configured) return failure('NOT_CONFIGURED', 503);
      if (route === '/api/guestbook/captcha' && request.method === 'GET' && provider === 'image') {
        const data = await upstream(config.captchaChallengeUrl, { ip }, true);
        if (!data.challengeId || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data.image || '') || data.image.length > 2_000_000) return failure('CAPTCHA_UNAVAILABLE', 502);
        return json({ challengeId: trim(data.challengeId, 200), image: data.image, expiresAt: trim(data.expiresAt, 40) });
      }
      if (route !== '/api/guestbook/messages' || request.method !== 'POST') return failure('NOT_FOUND', 404);
      const expectedOrigin = config.publicOrigin ? new URL(config.publicOrigin).origin : url.origin;
      if (request.headers.get('origin') !== expectedOrigin) return failure('ORIGIN_REJECTED', 403);
      if (!(request.headers.get('content-type') || '').startsWith('application/json')) return failure('INVALID_INPUT', 400);
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > 8192) return failure('INVALID_INPUT', 413);
      let input;
      try { input = JSON.parse(raw); } catch { return failure('INVALID_INPUT', 400); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return failure('INVALID_INPUT', 400);
      const content = typeof input.content === 'string' ? input.content.trim() : '';
      const nickname = typeof input.nickname === 'string' ? input.nickname.trim() : '';
      if (content.length < 4 || content.length > 2000 || nickname.length > 64 || input.consent !== true || !['zh-cn', 'ja', 'en'].includes(input.locale)) return failure('INVALID_INPUT', 400);
      const token = trim(input.captcha?.token, 2049);
      const challengeId = trim(input.captcha?.challengeId, 200);
      const answer = trim(input.captcha?.answer, 100);
      if (provider === 'turnstile' ? !token || token.length > 2048 : !challengeId || !answer) return failure('CAPTCHA_REQUIRED', 400);
      const idempotencyKey = request.headers.get('idempotency-key');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey || '')) return failure('INVALID_INPUT', 400);
      const now = Date.now();
      for (const [key, value] of attempts) if (now - value.since > 600_000) attempts.delete(key);
      const rate = attempts.get(ip) || { count: 0, since: now };
      if (rate.count >= 5) return failure('RATE_LIMITED', 429);
      rate.count += 1;
      attempts.set(ip, rate);
      const browser = input.browser && typeof input.browser === 'object' ? input.browser : {};
      const metadata = {
        visitorId,
        userAgent: trim(request.headers.get('user-agent'), 512),
        languages: Array.isArray(browser.languages) ? browser.languages.slice(0, 5).map(value => trim(value, 30)) : [],
        platform: trim(browser.platform, 80), timeZone: trim(browser.timeZone, 80),
        screen: trim(browser.screen, 40), viewport: trim(browser.viewport, 40),
      };
      const message = { nickname: publicNickname(nickname, { visitorId, country: context.country }), content, locale: input.locale, ip, browser: metadata };
      if (d1) {
        message.requestKey = await fingerprint(ip + ':' + idempotencyKey.toLowerCase());
        // Hash submitted identity, not generated fallback names or changing geolocation, so retries stay stable.
        message.payloadHash = await fingerprint(JSON.stringify([nickname, content, input.locale, isVisitorId(suppliedVisitorId) ? visitorId : '']));
        // A lost response can be replayed without reusing a consumed Turnstile token or creating another row.
        const previous = await d1.findRequest(message.requestKey);
        if (previous) {
          if (previous.payload_hash !== message.payloadHash) return failure('IDEMPOTENCY_CONFLICT', 409);
          return json({ id: String(previous.id), status: 'published' }, 201);
        }
      }
      let verificationId;
      if (provider === 'turnstile') {
        const verification = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: config.turnstileSecretKey, response: token, remoteip: ip === 'unknown' ? undefined : ip }),
          signal: AbortSignal.timeout(8000),
        });
        if (!verification.ok) return failure('CAPTCHA_UNAVAILABLE', 502);
        const data = await verification.json();
        if (data.success !== true || data.hostname !== url.hostname || data.action !== 'guestbook') return failure('CAPTCHA_INVALID', 400);
        verificationId = 'turnstile:' + idempotencyKey;
      } else {
        const verification = await upstream(config.captchaVerifyUrl, { challengeId, answer, ip }, true);
        if (verification.valid !== true || !verification.verificationId) return failure('CAPTCHA_INVALID', 400);
        verificationId = trim(verification.verificationId, 200);
      }
      if (d1) return json(await d1.create(message), 201);
      const target = new URL('v1/messages', config.baseUrl.endsWith('/') ? config.baseUrl : config.baseUrl + '/');
      const result = await upstream(target, { ...message, requestId: crypto.randomUUID(), idempotencyKey, captchaVerificationId: verificationId, consent: true });
      if (!['pending', 'published'].includes(result.status) || !result.id) return failure('UPSTREAM_UNAVAILABLE', 502);
      return json({ id: trim(result.id, 100), status: result.status }, 201);
    } catch (error) {
      if (error instanceof GuestbookStoreError) return failure(error.code, error.status);
      // Provider responses, SQL, IPs and credentials are never copied into public error messages.
      return failure('UPSTREAM_UNAVAILABLE', 502);
    }
  };
}
