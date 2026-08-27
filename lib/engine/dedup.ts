import { createHash } from 'crypto';
import { memGet, memSet } from './idempotency';

export function requestFingerprint(parts: {
  method: string;
  provider: string;
  path: string;
  body: string;
}): string {
  return createHash('sha256')
    .update(`${parts.method}|${parts.provider}|${parts.path}|${parts.body}`)
    .digest('hex');
}

export function dedupGet(workspaceId: string, fp: string) {
  return memGet(`dedup:${workspaceId}:${fp}`);
}

export function dedupSet(workspaceId: string, fp: string, status: number, body: string) {
  memSet(`dedup:${workspaceId}:${fp}`, status, body);
}
