import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase-admin';
import { vaultConfigured } from '@/lib/engine/vault';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOW_ORIGINS = new Set(['https://fred-platform.vercel.app', 'https://getgatezero.com']);

function cors(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get('origin') || '';
  if (ALLOW_ORIGINS.has(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
  }
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function GET(req: NextRequest) {
  const db = adminDb();
  return cors(
    req,
    NextResponse.json({
      ok: true,
      service: 'gatezero',
      embed: '/gate',
      engine: 'gatezero-2.1',
      product: 'GateZero',
      proxy: '/api/proxy/{provider}/...',
      kill: '/api/v1/kill',
      routes: {
        gate: '/gate',
        moat: '/moat',
        start: '/start',
        live: '/live',
        stats: '/api/stats',
        proxy: '/api/proxy',
        ledger: '/api/v1/ledger',
        spike: '/api/v1/spike',
        trap: '/api/v1/trap'
      },
      flags: {
        supabase: Boolean(db),
        vault: vaultConfigured(),
        stripe: Boolean(process.env.STRIPE_SECRET_KEY)
      },
      ts: new Date().toISOString()
    })
  );
}

export async function OPTIONS(req: NextRequest) {
  return cors(req, new NextResponse(null, { status: 204 }));
}
