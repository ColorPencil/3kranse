import { isVisitorId } from '../shared/visitor-id.mjs';

const regionNames = new Intl.DisplayNames(['zh-CN'], { type: 'region', fallback: 'none' });

export function defaultNickname(visitorId, country = '') {
  const code = typeof country === 'string' ? country.toUpperCase() : '';
  // Location comes only from edge context, never browser language or client location claims.
  const region = /^[A-Z]{2}$/.test(code) && !['XX', 'ZZ'].includes(code) ? regionNames.of(code) : '';
  const id = isVisitorId(visitorId) ? visitorId.toLowerCase() : crypto.randomUUID();
  return (region || '') + '玩家_' + id.replaceAll('-', '').slice(0, 16);
}

function oldIpSuffix(value) {
  if (value === 'unknown' || /^(?:\d{1,3}|\*\*)(?:\.(?:\d{1,3}|\*\*)){3}$/.test(value)) return true;
  if (/^\*\*(?::[0-9a-f*]+)+$/i.test(value)) return true;
  if (!/^[0-9a-f:.]+$/i.test(value) || !value.includes(':')) return false;
  try { return Boolean(new URL('http://[' + value + ']/').hostname); }
  catch { return false; }
}

export function publicNickname(value, { visitorId = '', country = '', legacyId = '' } = {}) {
  const nickname = typeof value === 'string' ? value.trim().slice(0, 64) : '';
  const legacy = /^(.{0,24}玩家)_(.+)$/u.exec(nickname);
  if (nickname && (!legacy || !oldIpSuffix(legacy[2]))) return nickname;
  // Old rows have no browser identifier. Use their public record ID, never an IP-derived identifier.
  if (legacyId) return (legacy?.[1] || '玩家') + '_历史' + String(legacyId).replace(/[^a-z0-9-]/gi, '').slice(0, 24);
  return defaultNickname(visitorId, country);
}
