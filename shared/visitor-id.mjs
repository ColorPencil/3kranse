export const visitorStorageKey = '3kranse.guestbook.visitorId';
export const isVisitorId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function browserVisitorId(storageFactory = () => localStorage, randomUUID = () => crypto.randomUUID()) {
  let storage;
  try {
    storage = storageFactory();
    const saved = storage.getItem(visitorStorageKey);
    if (isVisitorId(saved)) return saved.toLowerCase();
  } catch { /* Storage may be blocked; the caller retains a fresh ID for the current page. */ }
  // Random local identity avoids collecting a device fingerprint and is never an authentication factor.
  const id = randomUUID();
  try { storage?.setItem(visitorStorageKey, id); } catch { /* Posting must still work with storage disabled. */ }
  return id;
}
