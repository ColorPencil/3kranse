const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
const failure = (code, status) => json({ error: { code } }, status);
const trim = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export function guestbookConfig(env = {}) {
  return {
    baseUrl: env.GUESTBOOK_API_BASE_URL || '',
    token: env.GUESTBOOK_API_TOKEN || '',
    captchaChallengeUrl: env.CAPTCHA_CHALLENGE_URL || '',
    captchaVerifyUrl: env.CAPTCHA_VERIFY_URL || '',
    captchaToken: env.CAPTCHA_API_TOKEN || '',
    publicOrigin: env.SITE_URL || '',
  };
}

export function createGuestbookHandler(config, fetcher = fetch) {
  const attempts = new Map();
  // A missing CAPTCHA verifier must disable posting instead of silently bypassing verification.
  const configured = Boolean(config.baseUrl && config.token && config.captchaChallengeUrl && config.captchaVerifyUrl);
  async function upstream(url, payload, captcha = false) {
    const response = await fetcher(url, {
      method: payload ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${captcha ? config.captchaToken || config.token : config.token}`, 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`UPSTREAM_${response.status}`);
    return response.json();
  }
  return async function handle(request, context = {}) {
    const url = new URL(request.url);
    const route = url.pathname.replace(/\/$/, '');
    // Only the hosting adapter supplies a trusted visitor IP. Forwarded headers and client JSON are ignored.
    const ip = trim(context.ip, 80) || 'unknown';
    const defaultNickname = `玩家_${ip}`;
    if (route === '/api/guestbook/status' && request.method === 'GET') {
      return json({ available: configured, defaultNickname, captchaRequired: true });
    }
    if (!configured) return failure('NOT_CONFIGURED', 503);
    try {
      if (route === '/api/guestbook/messages' && request.method === 'GET') {
        const cursor = trim(url.searchParams.get('cursor'), 200);
        const target = new URL('v1/messages', config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`);
        target.searchParams.set('limit', '12');
        if (cursor) target.searchParams.set('cursor', cursor);
        const data = await upstream(target);
        // Never forward moderation fields, IPs, tokens or arbitrary backend HTML to the public list.
        const items = (Array.isArray(data.items) ? data.items : []).slice(0, 12).map(item => ({
          id: trim(item.id, 100), nickname: trim(item.nickname, 64), content: trim(item.content, 2000), createdAt: trim(item.createdAt, 40),
        }));
        return json({ items, nextCursor: trim(data.nextCursor, 200) || null });
      }
      if (route === '/api/guestbook/captcha' && request.method === 'GET') {
        const data = await upstream(config.captchaChallengeUrl, { ip }, true);
        if (!data.challengeId || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data.image || '') || data.image.length > 2_000_000) {
          return failure('CAPTCHA_UNAVAILABLE', 502);
        }
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
      if (!input || typeof input !== 'object') return failure('INVALID_INPUT', 400);
      const content = typeof input.content === 'string' ? input.content.trim() : '';
      const nickname = typeof input.nickname === 'string' ? input.nickname.trim() : '';
      if (content.length < 4 || content.length > 2000 || nickname.length > 64 || input.consent !== true || !['ja', 'zh-cn', 'en'].includes(input.locale)) return failure('INVALID_INPUT', 400);
      const challengeId = trim(input.captcha?.challengeId, 200);
      const answer = trim(input.captcha?.answer, 100);
      if (!challengeId || !answer) return failure('CAPTCHA_REQUIRED', 400);
      const idempotencyKey = request.headers.get('idempotency-key');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey || '')) return failure('INVALID_INPUT', 400);
      const now = Date.now();
      for (const [key, value] of attempts) if (now - value.since > 600_000) attempts.delete(key);
      const rate = attempts.get(ip) || { count: 0, since: now };
      if (rate.count >= 5) return failure('RATE_LIMITED', 429);
      rate.count += 1;
      attempts.set(ip, rate);
      const verification = await upstream(config.captchaVerifyUrl, { challengeId, answer, ip }, true);
      if (verification.valid !== true || !verification.verificationId) return failure('CAPTCHA_INVALID', 400);
      const browser = input.browser && typeof input.browser === 'object' ? input.browser : {};
      const metadata = {
        userAgent: trim(request.headers.get('user-agent'), 512),
        languages: Array.isArray(browser.languages) ? browser.languages.slice(0, 5).map(value => trim(value, 30)) : [],
        platform: trim(browser.platform, 80), timeZone: trim(browser.timeZone, 80),
        screen: trim(browser.screen, 40), viewport: trim(browser.viewport, 40),
      };
      const target = new URL('v1/messages', config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`);
      const result = await upstream(target, {
        requestId: crypto.randomUUID(), idempotencyKey, nickname: nickname || defaultNickname,
        content, locale: input.locale, ip, browser: metadata,
        captchaVerificationId: trim(verification.verificationId, 200), consent: true,
      });
      if (!['pending', 'published'].includes(result.status) || !result.id) return failure('UPSTREAM_UNAVAILABLE', 502);
      return json({ id: trim(result.id, 100), status: result.status }, 201);
    } catch {
      // Deliberately omit upstream URLs, credentials and provider responses from visitor errors.
      return failure('UPSTREAM_UNAVAILABLE', 502);
    }
  };
}
