export function toWebRequest(req) {
  const method = req.method || 'GET';
  return new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
    method, headers: req.headers,
    ...(method !== 'GET' && method !== 'HEAD' ? { body: req, duplex: 'half' } : {}),
  });
}

export async function sendWebResponse(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}
