const mem = new Map<string, { at: number; body: string; status: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;

export function memGet(key: string) {
  const hit = mem.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    mem.delete(key);
    return null;
  }
  return hit;
}

export function memSet(key: string, status: number, body: string) {
  mem.set(key, { at: Date.now(), status, body });
  if (mem.size > 5000) {
    const first = mem.keys().next().value;
    if (first) mem.delete(first);
  }
}
