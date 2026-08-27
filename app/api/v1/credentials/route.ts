import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase-admin';
import { encryptSecret, hashToken, maskSecret } from '@/lib/engine/vault';
import { burnCredential, listCredentials } from '@/lib/engine/workspace';
import { UPSTREAM } from '@/lib/engine/upstream';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const db = adminDb();
  if (!db) return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
  const token = req.headers.get('x-gz-key') || '';
  if (!token.startsWith('gz_')) {
    return NextResponse.json({ error: 'x-gz-key required' }, { status: 401 });
  }
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
  const { data: ws } = await db
    .from('workspaces')
    .select('id')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (!ws) return NextResponse.json({ error: 'unknown_workspace' }, { status: 401 });
  const enc = encryptSecret(secret);
  const { error } = await db.from('provider_credentials').upsert(
    {
      workspace_id: ws.id,
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
      'Server-side proxy stores this credential encrypted at rest (AES-256-GCM). It is decrypted only in memory per request. Browser SW mode still never sends keys.'
  });
}


export async function GET(req: NextRequest) {
  const db = adminDb();
  if (!db) return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
  const token = req.headers.get('x-gz-key') || '';
  if (!token.startsWith('gz_')) return NextResponse.json({ error: 'x-gz-key required' }, { status: 401 });
  const { data: ws } = await db.from('workspaces').select('id').eq('token_hash', hashToken(token)).maybeSingle();
  if (!ws) return NextResponse.json({ error: 'unknown_workspace' }, { status: 401 });
  const rows = await listCredentials(ws.id);
  return NextResponse.json({ credentials: rows });
}

export async function DELETE(req: NextRequest) {
  const db = adminDb();
  if (!db) return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
  const token = req.headers.get('x-gz-key') || '';
  if (!token.startsWith('gz_')) return NextResponse.json({ error: 'x-gz-key required' }, { status: 401 });
  const provider = (req.nextUrl.searchParams.get('provider') || '').toLowerCase();
  if (!provider) return NextResponse.json({ error: 'provider query required' }, { status: 400 });
  const { data: ws } = await db.from('workspaces').select('id').eq('token_hash', hashToken(token)).maybeSingle();
  if (!ws) return NextResponse.json({ error: 'unknown_workspace' }, { status: 401 });
  await burnCredential(ws.id, provider);
  return NextResponse.json({ ok: true, burned: provider });
}
