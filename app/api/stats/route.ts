import { NextResponse } from 'next/server';
import { publicStats } from '@/lib/engine/stats';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

export async function GET() {
  const stats = await publicStats();
  const res = NextResponse.json({
    ...stats,
    takeBps: 2000,
    engine: 'gatezero-2.1',
    ts: new Date().toISOString()
  });
  res.headers.set('cache-control', 'no-store, max-age=0');
  res.headers.set('cdn-cache-control', 'no-store');
  res.headers.set('vercel-cdn-cache-control', 'no-store');
  return res;
}
