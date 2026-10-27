import { isIP } from 'node:net';
const normalize = value => String(value || '').replace(/^::ffff:/, '').trim();
export function clientIP(req, trustedIPs = '') {
  const peer = normalize(req.socket.remoteAddress);
  const trusted = new Set(trustedIPs.split(',').map(normalize).filter(value => isIP(value)));
  if (!trusted.has(peer)) return isIP(peer) ? peer : 'unknown';
  const chain = String(req.headers['x-forwarded-for'] || '').split(',').map(normalize);
  // Walk from the trusted socket toward the visitor, stopping before untrusted user-supplied hops.
  let address = peer;
  for (let index = chain.length - 1; index >= 0 && trusted.has(address); index -= 1) {
    if (!isIP(chain[index])) break;
    address = chain[index];
  }
  return isIP(address) ? address : 'unknown';
}
