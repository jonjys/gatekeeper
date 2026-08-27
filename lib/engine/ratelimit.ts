const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (b.n >= limit) return false;
  b.n += 1;
  return true;
}
