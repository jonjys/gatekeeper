export const UPSTREAM: Record<string, string> = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  stripe: 'https://api.stripe.com'
};

export const HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length'
]);

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { timeoutMs?: number; retries?: number } = {}
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const retries = opts.retries ?? 3;
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(t);
      if (res.status >= 500 && i < retries - 1) {
        await sleep(200 * 2 ** i);
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (i < retries - 1) await sleep(200 * 2 ** i);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('upstream_failed');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
