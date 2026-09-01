import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGO = 'aes-256-gcm';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function mintWorkspaceToken(): string {
  return 'gz_live_' + randomBytes(24).toString('hex');
}

function keyBuf(): Buffer {
  const raw = process.env.GATEZERO_VAULT_KEY || '';
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error('GATEZERO_VAULT_KEY must be 64 hex chars in production');
  }
  return createHash('sha256').update(raw || 'gatezero-dev-vault-key').digest();
}

export function vaultConfigured(): boolean {
  return Boolean(process.env.GATEZERO_VAULT_KEY);
}

export function encryptSecret(plain: string): { ciphertext: string; iv: string; tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBuf(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}

export function decryptSecret(row: { ciphertext: string; iv: string; tag: string }): string {
  const decipher = createDecipheriv(ALGO, keyBuf(), Buffer.from(row.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.tag, 'base64'));
  const out = Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, 'base64')),
    decipher.final()
  ]);
  return out.toString('utf8');
}

export function maskSecret(s: string): string {
  if (s.length < 8) return '****';
  return s.slice(0, 4) + '…' + s.slice(-4);
}
