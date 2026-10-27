import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultNickname, publicNickname } from '../../server/guestbook-identity.mjs';
import { browserVisitorId, isVisitorId, visitorStorageKey } from '../../shared/visitor-id.mjs';
import { createGuestbookHandler } from '../../server/guestbook.mjs';
import worker from '../../cloudflare/pages-worker.mjs';

const visitorId = 'a4f8c91e-6b2d-4053-8c10-123456789abc';
const suffix = 'a4f8c91e6b2d4053';
const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
};

test('browser ID is persisted and reused, independent of IP or device fingerprint', () => {
  const saved = storage();
  let generated = 0;
  const factory = () => { generated += 1; return visitorId; };
  assert.equal(browserVisitorId(() => saved, factory), visitorId);
  assert.equal(saved.getItem(visitorStorageKey), visitorId);
  assert.equal(browserVisitorId(() => saved, factory), visitorId);
  assert.equal(generated, 1);
});

test('cleared or corrupted storage creates a new ID; blocked storage does not prevent posting', () => {
  const saved = storage();
  saved.setItem(visitorStorageKey, '203.0.113.7');
  assert.equal(browserVisitorId(() => saved, () => visitorId), visitorId);
  assert.equal(browserVisitorId(() => { throw new Error('blocked'); }, () => visitorId), visitorId);
  assert.equal(browserVisitorId(() => ({ getItem: () => null, setItem: () => { throw new Error('quota'); } }), () => visitorId), visitorId);
  const first = browserVisitorId(() => storage());
  const second = browserVisitorId(() => storage());
  assert.ok(isVisitorId(first) && isVisitorId(second));
  assert.notEqual(first, second);
});

test('country labels have a stable random suffix and never use an IP as identity', () => {
  for (const [country, label] of [['CN', '中国'], ['JP', '日本'], ['US', '美国'], ['', ''], ['XX', ''], ['T1', ''], ['ZZ', '']]) {
    assert.equal(defaultNickname(visitorId, country), label + '玩家_' + suffix);
  }
  assert.match(defaultNickname('45.12.88.149', 'CN'), /^中国玩家_[0-9a-f]{16}$/);
  assert.equal(defaultNickname(visitorId.toUpperCase(), 'JP'), '日本玩家_' + suffix);
});

test('historical IPv4, IPv6 and masked IP names use the message ID; custom names remain', () => {
  for (const name of ['玩家_45.12.88.149', '玩家_**.**.88.149', '玩家_2001:db8::88:149', '玩家_**:**:**:**:**:**:88:149', '玩家_unknown']) {
    assert.equal(publicNickname(name, { legacyId: '123', country: 'JP' }), '玩家_历史123');
  }
  assert.equal(publicNickname('', { legacyId: '123' }), '玩家_历史123');
  assert.equal(publicNickname('玩家_45.12.88.149', { visitorId, country: 'CN' }), '中国玩家_' + suffix);
  for (const name of ['铅笔', '玩家_99', '日本玩家_' + suffix, '<script>']) assert.equal(publicNickname(name), name);
});

test('Worker uses edge country and browser random ID, never IP or conflicting country claims', async () => {
  const request = new Request('https://site.test/api/guestbook/status', {
    headers: { 'CF-Connecting-IP': '45.12.88.149', 'CF-IPCountry': 'CN', 'Accept-Language': 'zh-CN', 'X-Guestbook-Visitor': visitorId },
  });
  Object.defineProperty(request, 'cf', { value: { country: 'JP' } });
  const data = await (await worker.fetch(request, {})).json();
  assert.equal(data.defaultNickname, '日本玩家_' + suffix);
  assert.doesNotMatch(JSON.stringify(data), /45\.12|88\.149/);
  const ordinary = new Request(request.url, { headers: request.headers });
  assert.equal((await (await worker.fetch(ordinary, {})).json()).defaultNickname, '玩家_' + suffix);
});

test('legacy upstream public list removes IP suffixes without exposing private fields', async () => {
  const handler = createGuestbookHandler({ baseUrl: 'https://backend.test/', token: 'test' }, async () => new Response(JSON.stringify({
    items: [{ id: '1', nickname: '玩家_45.12.88.149', content: '旧留言', createdAt: '2026-10-27', ip: '45.12.88.149' }], nextCursor: null,
  })));
  const data = await (await handler(new Request('https://site.test/api/guestbook/messages'), { ip: '1.2.3.4', country: 'JP' })).json();
  assert.equal(data.items[0].nickname, '玩家_历史1');
  assert.deepEqual(Object.keys(data.items[0]), ['id', 'nickname', 'content', 'createdAt']);
  assert.doesNotMatch(JSON.stringify(data), /45\.12|88\.149|1\.2\.3\.4/);
});

test('absent or forged browser IDs fall back to a random public name without echoing input', async () => {
  const handler = createGuestbookHandler({});
  for (const id of ['', '45.12.88.149', 'not-an-id']) {
    const data = await (await handler(new Request('https://site.test/api/guestbook/status', { headers: { 'X-Guestbook-Visitor': id } }), { ip: '45.12.88.149' })).json();
    assert.match(data.defaultNickname, /^玩家_[0-9a-f]{16}$/);
    assert.doesNotMatch(JSON.stringify(data), /45\.12|88\.149|not-an-id/);
  }
});
