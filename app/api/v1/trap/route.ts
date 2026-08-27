import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/engine/auth';
import { insertTrap } from '@/lib/engine/workspace';
import { hashToken, maskSecret } from '@/lib/engine/vault';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireWorkspace(req);
  if ('error' in auth) return auth.error;
  let body: { secret?: string; label?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const secret = (body.secret || '').trim();
  if (!secret) return NextResponse.json({ error: 'secret required' }, { status: 400 });
  const { error } = await insertTrap(auth.ws.id, hashToken(secret), body.label || 'honeypot');
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({
    ok: true,
    masked: maskSecret(secret),
    note: 'Requests presenting this key return 451 TRAP and are never forwarded.'
  });
}
