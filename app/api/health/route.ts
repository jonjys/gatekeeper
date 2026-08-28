import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOW_ORIGIN = 'https://fred-platform.vercel.app';

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function GET() {
  const db = adminDb();
  return cors(
    NextResponse.json({
      ok: true,
      service: 'gatezero',
      embed: '/gate',
      engine: 'gatezero-2.1',
      product: 'BridgeControl Solo',
      proxy: '/api/proxy/{provider}/...',
      kill: '/api/v1/kill',
      routes: {
        gate: '/gate',
        moat: '/moat',
        start: '/start',
        proxy: '/api/proxy',
        ledger: '/api/v1/ledger'
      },
      flags: {
        supabase: Boolean(db),
        vault: Boolean(process.env.GATEZERO_VAULT_KEY),
        stripe: Boolean(process.env.STRIPE_SECRET_KEY)
      },
      ts: new Date().toISOString()
    })
  );
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}
