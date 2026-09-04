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
  'content-length',
  'content-encoding',
  'content-md5',
  'cookie',
  'set-cookie',
  'authorization',
  'x-api-key',
  'x-upstream-authorization'
]);

/** Only these client headers may ride to the provider. */
export const FORWARD = new Set([
  'content-type',
  'accept',
  'anthropic-version',
  'anthropic-beta',
  'openai-beta',
  'openai-organization'
]);

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { timeoutMs?: number; retries?: number } = {}
): Promise<Response> {
  const method = String(init.method || 'GET').toUpperCase();
  const safe = method === 'GET' || method === 'HEAD';
  const timeoutMs = opts.timeoutMs ?? (safe ? 30_000 : 120_000);
  const retries = safe ? opts.retries ?? 3 : 1;
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(t);
      if (safe && res.status >= 500 && i < retries - 1) {
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
