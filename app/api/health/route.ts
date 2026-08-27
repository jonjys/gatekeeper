import { NextResponse } from 'next/server';

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
  return cors(
    NextResponse.json({
      ok: true,
      service: 'gatezero',
      embed: '/gate',
      engine: 'gatezero-2.0',
      proxy: '/api/proxy/{provider}/...',
      routes: { gate: '/gate', moat: '/moat', start: '/start', proxy: '/api/proxy' },
      ts: new Date().toISOString()
    })
  );
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}
