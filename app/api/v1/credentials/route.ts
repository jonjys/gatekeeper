import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase-admin';
import { requireWorkspace } from '@/lib/engine/auth';
import { encryptSecret, maskSecret, vaultConfigured } from '@/lib/engine/vault';
import { burnCredential, listCredentials } from '@/lib/engine/workspace';
import { UPSTREAM } from '@/lib/engine/upstream';
import { rateLimit } from '@/lib/engine/ratelimit';
import { looksLikeTrapKey } from '@/lib/engine/policy';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!vaultConfigured() && (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production')) {
    return NextResponse.json(
      { error: 'vault_unconfigured', hint: 'Set GATEZERO_VAULT_KEY to 64 hex chars' },
      { status: 503 }
    );
  }
  const auth = await requireWorkspace(req);
  if ('error' in auth) return auth.error;
  if (!rateLimit(`cred:${auth.ws.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const db = adminDb();
  if (!db) return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
  let body: { provider?: string; secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const provider = (body.provider || '').toLowerCase();
  const secret = (body.secret || '').trim();
  if (!UPSTREAM[provider] || !secret) {
    return NextResponse.json({ error: 'provider and secret required' }, { status: 400 });
  }
  if (secret.length < 8) {
    return NextResponse.json({ error: 'secret_too_short' }, { status: 400 });
  }
  if (looksLikeTrapKey(secret)) {
    return NextResponse.json(
      { error: 'trap_secret', hint: 'Honeypot keys belong in POST /api/v1/trap, not the provider vault' },
      { status: 400 }
    );
  }
  let enc: { ciphertext: string; iv: string; tag: string };
  try {
    enc = encryptSecret(secret);
  } catch (e) {
    return NextResponse.json(
      { error: 'vault_encrypt_failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
  const { error } = await db.from('provider_credentials').upsert(
    {
      workspace_id: auth.ws.id,
      provider,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      tag: enc.tag,
      masked: maskSecret(secret)
    },
    { onConflict: 'workspace_id,provider' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    provider,
    masked: maskSecret(secret),
    honest:
      'Server-side proxy stores this credential encrypted at rest (AES-256-GCM). It is decrypted only in memory per request.'
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireWorkspace(req);
  if ('error' in auth) return auth.error;
  const rows = await listCredentials(auth.ws.id);
  return NextResponse.json({ credentials: rows });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireWorkspace(req);
  if ('error' in auth) return auth.error;
  const provider = (req.nextUrl.searchParams.get('provider') || '').toLowerCase();
  if (!provider) return NextResponse.json({ error: 'provider query required' }, { status: 400 });
  await burnCredential(auth.ws.id, provider);
  return NextResponse.json({ ok: true, burned: provider });
}
