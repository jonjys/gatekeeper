import { NextResponse } from 'next/server';
import { publicStats } from '@/lib/engine/stats';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const stats = await publicStats();
  return NextResponse.json(
    { ...stats, takeBps: 2000, engine: 'gatezero-2.1' },
    { headers: { 'cache-control': 'no-store' } }
  );
}
