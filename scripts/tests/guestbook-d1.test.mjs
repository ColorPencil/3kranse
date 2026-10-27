import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createGuestbookHandler, guestbookConfig } from '../../server/guestbook.mjs';

const config = guestbookConfig({
  GUESTBOOK_STORAGE: 'd1', D1_ACCOUNT_ID: 'a'.repeat(32),
  D1_DATABASE_ID: 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb', D1_API_TOKEN: 'private-d1-test',
  CAPTCHA_PROVIDER: 'turnstile', TURNSTILE_SITE_KEY: 'public-site-test', TURNSTILE_SECRET_KEY: 'private-turnstile-test',
});
const valid = { nickname: '', content: '期待这个游戏！', locale: 'zh-cn', consent: true, captcha: { token: 'verified-test-token' }, ip: 'forged-client-ip', browser: { languages: ['zh-CN'], platform: 'test', secret: 'discard' } };
const ip = '203.0.113.7';
function request(body = valid, key = crypto.randomUUID(), origin = 'https://site.test') {
  return new Request('https://site.test/api/guestbook/messages', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'Idempotency-Key': key, 'User-Agent': 'Trusted header UA', 'X-Guestbook-Visitor': 'a4f8c91e-6b2d-4053-8c10-123456789abc' },
    body: JSON.stringify(body),
  });
}
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
function fixture(t) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT, ip TEXT, message TEXT, message_time DATETIME DEFAULT CURRENT_TIMESTAMP)');
  t.after(() => db.close());
  const calls = [];
  const state = { verification: { success: true, hostname: 'site.test', action: 'guestbook' }, d1Failure: null };
  async function fetcher(url, options) {
    const payload = JSON.parse(options.body);
    calls.push({ url: String(url), headers: options.headers, payload });
    if (String(url) === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') return response(state.verification);
    assert.match(String(url), /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/a+\/d1\/database\/bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb\/raw$/);
    assert.equal(options.headers.Authorization, 'Bearer private-d1-test');
    if (state.d1Failure) return response(state.d1Failure, 403);
    try {
      db.exec('BEGIN');
      const result = (payload.batch || [payload]).map(({ sql, params = [] }) => {
        const statement = db.prepare(sql);
        const columns = statement.columns().map(column => column.name);
        const rows = statement.all(...params).map(row => columns.map(column => row[column]));
        return { success: true, results: { columns, rows } };
      });
      db.exec('COMMIT');
      return response({ success: true, result });
    } catch {
      db.exec('ROLLBACK');
      return response({ success: false, errors: [{ message: 'private provider SQL error' }] });
    }
  }
  return { db, calls, state, fetcher, handler: () => createGuestbookHandler(config, fetcher) };
}

test('D1 reads the original table while missing Turnstile secrets keep posting disabled', async t => {
  const f = fixture(t);
  const handler = createGuestbookHandler({ ...config, turnstileSecretKey: '' }, f.fetcher);
  const status = await (await handler(new Request('https://site.test/api/guestbook/status'), { ip })).json();
  assert.equal(status.available, false);
  assert.equal(status.readable, true);
  assert.equal(status.captchaProvider, 'turnstile');
  assert.equal(status.turnstileSiteKey, 'public-site-test');
  assert.doesNotMatch(JSON.stringify(status), /private-d1|private-turnstile|accountId|databaseId/);
  const list = await handler(new Request('https://site.test/api/guestbook/messages'));
  assert.deepEqual(await list.json(), { items: [], nextCursor: null });
  assert.equal((await handler(request(), { ip })).status, 503);
  assert.equal(f.calls.length, 1);
});

test('D1 stores trusted IP, plain message and whitelisted browser data; public list is minimal', async t => {
  const f = fixture(t);
  const handler = f.handler();
  const body = { ...valid, content: "<img src=x onerror=evil> '; DROP TABLE messages; --" };
  const result = await handler(request(body), { ip });
  assert.equal(result.status, 201);
  assert.deepEqual(await result.json(), { id: '1', status: 'published' });
  const saved = f.db.prepare('SELECT * FROM messages').get();
  assert.equal(saved.ip, ip);
  assert.equal(saved.nickname, '玩家_a4f8c91e6b2d4053');
  assert.equal(saved.message, body.content);
  const metadata = JSON.parse(f.db.prepare('SELECT browser_json FROM message_metadata').get().browser_json);
  assert.equal(metadata.userAgent, 'Trusted header UA');
  assert.equal(metadata.visitorId, 'a4f8c91e-6b2d-4053-8c10-123456789abc');
  assert.equal(metadata.secret, undefined);
  assert.equal(metadata.ip, undefined);
  const data = await (await handler(new Request('https://site.test/api/guestbook/messages'))).json();
  assert.deepEqual(Object.keys(data.items[0]), ['id', 'nickname', 'content', 'createdAt']);
  assert.equal(data.items[0].content, body.content);
  assert.match(data.items[0].createdAt, /T.*Z$/);
  const verification = f.calls.find(call => call.url.includes('/siteverify'));
  assert.equal(verification.payload.remoteip, ip);
  assert.equal(verification.payload.secret, 'private-turnstile-test');
  assert.equal(verification.headers.Authorization, undefined);
  const insert = f.calls.find(call => call.payload.batch?.some(item => item.sql.startsWith('INSERT INTO messages')));
  assert.equal(insert.payload.batch[0].sql.includes(body.content), false);
  assert.equal(insert.payload.batch[0].params[2], body.content);
});

test('Turnstile failures, foreign hostnames and wrong actions never create messages', async t => {
  const f = fixture(t);
  for (const verification of [
    { success: false, hostname: 'site.test', action: 'guestbook' },
    { success: true, hostname: 'other.test', action: 'guestbook' },
    { success: true, hostname: 'site.test', action: 'login' },
  ]) {
    f.state.verification = verification;
    const result = await f.handler()(request(), { ip });
    assert.equal(result.status, 400);
    assert.equal((await result.json()).error.code, 'CAPTCHA_INVALID');
  }
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 0);
});

test('foreign origins, oversized tokens and absent consent are rejected before provider access', async t => {
  const f = fixture(t);
  const handler = f.handler();
  assert.equal((await handler(request(valid, crypto.randomUUID(), 'https://evil.test'), { ip })).status, 403);
  for (const body of [{ ...valid, consent: false }, { ...valid, captcha: null }, { ...valid, captcha: { token: 'x'.repeat(2049) } }]) {
    assert.equal((await handler(request(body), { ip })).status, 400);
  }
  assert.equal(f.calls.length, 0);
});

test('pagination is stable for 27 rows and malformed or oversized cursors are rejected', async t => {
  const f = fixture(t);
  const insert = f.db.prepare('INSERT INTO messages (nickname, ip, message) VALUES (?, ?, ?)');
  for (let n = 1; n <= 27; n += 1) insert.run('Player ' + n, '198.51.100.' + n, 'Message ' + n);
  const handler = f.handler();
  const ids = [];
  let cursor = '';
  do {
    const page = await (await handler(new Request('https://site.test/api/guestbook/messages' + (cursor ? '?cursor=' + cursor : '')))).json();
    assert.ok(page.items.length <= 12);
    ids.push(...page.items.map(item => item.id));
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(new Set(ids).size, 27);
  assert.equal(ids[0], '27');
  assert.equal(ids.at(-1), '1');
  for (const invalid of ['0', '-1', 'abc', '9223372036854775808', '1%20OR%201=1']) {
    assert.equal((await handler(new Request('https://site.test/api/guestbook/messages?cursor=' + invalid))).status, 400);
  }
});

test('replayed requests across handlers reuse the row and reject a changed payload', async t => {
  const f = fixture(t);
  const key = crypto.randomUUID();
  const first = await f.handler()(request(valid, key), { ip });
  assert.equal(first.status, 201);
  f.state.verification = { success: false };
  const replay = await f.handler()(request({ ...valid, captcha: { token: 'consumed-token' } }, key), { ip });
  assert.equal(replay.status, 201);
  assert.equal((await replay.json()).id, '1');
  const conflict = await f.handler()(request({ ...valid, content: '另一份不同内容' }, key), { ip });
  assert.equal(conflict.status, 409);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 1);
  assert.equal(f.calls.filter(call => call.url.includes('/siteverify')).length, 1);
});

test('D1 enforces five posts per IP even when every request uses a new Worker handler', async t => {
  const f = fixture(t);
  for (let n = 0; n < 5; n += 1) assert.equal((await f.handler()(request(), { ip })).status, 201);
  const limited = await f.handler()(request(), { ip });
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, 'RATE_LIMITED');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 5);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM message_metadata').get().n, 5);
});

test('a failed metadata statement rolls back the message insert', async t => {
  const f = fixture(t);
  const handler = f.handler();
  assert.equal((await handler(request(), { ip })).status, 201);
  f.db.exec("CREATE TRIGGER reject_metadata BEFORE INSERT ON message_metadata BEGIN SELECT RAISE(ABORT, 'private failure'); END");
  const result = await handler(request({ ...valid, content: '触发元数据回滚测试' }), { ip });
  assert.equal(result.status, 502);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 1);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM message_metadata').get().n, 1);
  assert.doesNotMatch(await result.text(), /SQL|private|https:|Bearer/);
});

test('D1 auth failures and invalid identifiers do not expose credentials or query details', async t => {
  const f = fixture(t);
  f.state.d1Failure = { success: false, errors: [{ message: 'private-d1-test SELECT private' }] };
  const result = await f.handler()(new Request('https://site.test/api/guestbook/messages'));
  assert.equal(result.status, 502);
  assert.deepEqual(await result.json(), { error: { code: 'UPSTREAM_UNAVAILABLE' } });
  const invalid = createGuestbookHandler({ ...config, d1: { ...config.d1, accountId: '../evil' } }, f.fetcher);
  assert.equal((await invalid(request(), { ip })).status, 503);
  assert.equal(f.calls.length, 1);
});

test('historical defaults are redacted by D1 read without changing stored IPs or custom names', async t => {
  const f = fixture(t);
  const insert = f.db.prepare('INSERT INTO messages (nickname, ip, message) VALUES (?, ?, ?)');
  insert.run('玩家_45.12.88.149', '45.12.88.149', '旧留言');
  insert.run('木头', '45.12.88.149', '自定义昵称');
  insert.run('', '45.12.88.149', '空白旧昵称');
  const data = await (await f.handler()(new Request('https://site.test/api/guestbook/messages'), { ip, country: 'JP' })).json();
  assert.deepEqual(data.items.map(item => item.nickname), ['玩家_历史3', '木头', '玩家_历史1']);
  assert.doesNotMatch(JSON.stringify(data), /45\.12\.88\.149/);
  assert.equal(f.db.prepare('SELECT nickname FROM messages WHERE id = 1').get().nickname, '玩家_45.12.88.149');
  assert.equal(f.db.prepare('SELECT ip FROM messages WHERE id = 1').get().ip, '45.12.88.149');
});

test('browser ID defaults are stored without IP, including explicitly submitted old defaults', async t => {
  const f = fixture(t);
  for (const nickname of ['', '玩家_' + ip]) {
    const result = await f.handler()(request({ ...valid, nickname, country: 'JP' }), { ip, country: 'CN' });
    assert.equal(result.status, 201);
  }
  const rows = f.db.prepare('SELECT nickname, ip FROM messages').all();
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.nickname, '中国玩家_a4f8c91e6b2d4053');
    assert.equal(row.ip, ip);
  }
});

test('changing anonymous IDs cannot bypass the shared per-IP posting limit', async t => {
  const f = fixture(t);
  for (let n = 0; n < 6; n += 1) {
    const incoming = request({ ...valid, content: '匿名ID切换测试 ' + n });
    incoming.headers.set('X-Guestbook-Visitor', crypto.randomUUID());
    const result = await f.handler()(incoming, { ip });
    assert.equal(result.status, n < 5 ? 201 : 429);
  }
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 5);
});

test('older clients without browser IDs can replay a lost successful response', async t => {
  const f = fixture(t);
  const key = crypto.randomUUID();
  const incoming = () => {
    const value = request(valid, key);
    value.headers.delete('X-Guestbook-Visitor');
    return value;
  };
  const first = await f.handler()(incoming(), { ip });
  const second = await f.handler()(incoming(), { ip });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.deepEqual(await first.json(), await second.json());
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 1);
});
