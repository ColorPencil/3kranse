import { publicNickname } from './guestbook-identity.mjs';

const accountPattern = /^[a-f0-9]{32}$/i;
const databasePattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export class GuestbookStoreError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

export const schemaStatements = [
  'CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT, ip TEXT, message TEXT, message_time DATETIME DEFAULT CURRENT_TIMESTAMP)',
  // Keep the author's original five columns intact; private metadata is stored separately.
  'CREATE TABLE IF NOT EXISTS message_metadata (message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE, request_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL, locale TEXT NOT NULL, browser_json TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS messages_ip_time ON messages (ip, message_time)',
];

const requestQuery = 'SELECT CAST(m.id AS TEXT) AS id, x.payload_hash FROM message_metadata x JOIN messages m ON m.id = x.message_id WHERE x.request_key = ?';
const insertMessage = [
  'INSERT INTO messages (nickname, ip, message)',
  'SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM message_metadata WHERE request_key = ?)',
  "AND (SELECT COUNT(*) FROM messages WHERE ip = ? AND message_time >= datetime('now', '-10 minutes')) < 5",
].join(' ');
const insertMetadata = [
  'INSERT INTO message_metadata (message_id, request_key, payload_hash, locale, browser_json)',
  'SELECT last_insert_rowid(), ?, ?, ?, ? WHERE changes() = 1',
].join(' ');

export async function fingerprint(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createD1Store(config = {}, fetcher = fetch) {
  const token = (config.token || '').trim().replace(/^Bearer\s+/i, '');
  const configured = Boolean(accountPattern.test(config.accountId || '') && databasePattern.test(config.databaseId || '') && token);
  const endpoint = 'https://api.cloudflare.com/client/v4/accounts/' + config.accountId + '/d1/database/' + config.databaseId + '/raw';
  let initialization;
  async function query(body) {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('D1_UNAVAILABLE');
    const data = await response.json();
    if (data.success !== true || !Array.isArray(data.result) || data.result.some(item => item.success !== true)) throw new Error('D1_UNAVAILABLE');
    // /raw returns column names and row arrays; never expose its provider envelope to players.
    return data.result.map(item => {
      const columns = item.results?.columns || [];
      const rows = item.results?.rows || [];
      if (!Array.isArray(columns) || !Array.isArray(rows)) throw new Error('D1_UNAVAILABLE');
      return rows.map(row => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
    });
  }
  async function ensureSchema() {
    if (!initialization) {
      initialization = query({ batch: schemaStatements.map(sql => ({ sql, params: [] })) }).catch(error => {
        initialization = null;
        throw error;
      });
    }
    await initialization;
  }
  async function findRequest(key) {
    await ensureSchema();
    const [rows] = await query({ sql: requestQuery, params: [key] });
    return rows[0] || null;
  }
  return {
    configured,
    async list(cursor) {
      if (cursor && (!/^[1-9]\d{0,18}$/.test(cursor) || BigInt(cursor) > 9223372036854775807n)) throw new GuestbookStoreError('INVALID_INPUT', 400);
      const where = cursor ? ' WHERE messages.id < CAST(? AS INTEGER)' : '';
      const [rows] = await query({
        sql: 'SELECT CAST(id AS TEXT) AS id, nickname, message AS content, message_time AS createdAt FROM messages' + where + ' ORDER BY messages.id DESC LIMIT ?',
        params: cursor ? [cursor, '13'] : ['13'],
      });
      const items = rows.slice(0, 12).map(row => ({
        id: String(row.id), nickname: publicNickname(row.nickname, { legacyId: String(row.id) }), content: String(row.content || '').slice(0, 2000),
        createdAt: /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d+)?$/.test(row.createdAt || '') ? row.createdAt.replace(' ', 'T') + 'Z' : String(row.createdAt || '').slice(0, 40),
      }));
      return { items, nextCursor: rows.length > 12 ? items.at(-1).id : null };
    },
    findRequest,
    async create(input) {
      await ensureSchema();
      // One D1 batch keeps the insert, metadata and replay lookup together. Never retry writes automatically.
      const batches = await query({ batch: [
        { sql: insertMessage, params: [input.nickname, input.ip, input.content, input.requestKey, input.ip] },
        { sql: insertMetadata, params: [input.requestKey, input.payloadHash, input.locale, JSON.stringify(input.browser)] },
        { sql: requestQuery, params: [input.requestKey] },
      ] });
      const saved = batches[2]?.[0];
      if (!saved) throw new GuestbookStoreError('RATE_LIMITED', 429);
      if (saved.payload_hash !== input.payloadHash) throw new GuestbookStoreError('IDEMPOTENCY_CONFLICT', 409);
      return { id: String(saved.id), status: 'published' };
    },
  };
}
