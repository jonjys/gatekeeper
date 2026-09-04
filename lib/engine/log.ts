const SECRET_FIELD =
  /^(secret|password|authorization|api[-_]?key|x-api-key|x-gz-key|x-upstream-authorization|token|ciphertext|iv|tag|upstreamauth|upstream_auth)$/i;

const SECRET_VALUE =
  /\b(sk-(?:ant-)?[A-Za-z0-9_-]{8,}|gz_(?:live|test)_[A-Fa-f0-9]{16,}|Bearer\s+\S+|whsec_[A-Za-z0-9]+|sk_(?:live|test)_[A-Za-z0-9]+|rk_(?:live|test)_[A-Za-z0-9]+)/g;

export function redactForLog(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(SECRET_VALUE, '[redacted]');
  if (Array.isArray(value)) return value.map(redactForLog);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_FIELD.test(k) ? '[redacted]' : redactForLog(v);
    }
    return out;
  }
  return value;
}

export function slog(event: string, fields: Record<string, unknown> = {}) {
  const safe = (redactForLog(fields) || {}) as Record<string, unknown>;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    svc: 'gatezero',
    event,
    ...safe
  });
  if (safe.level === 'error') console.error(line);
  else console.log(line);
}
