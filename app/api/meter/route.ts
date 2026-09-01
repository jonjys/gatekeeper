import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Meter events are written on the proxy hop. This leftover is closed. */
export async function POST() {
  return NextResponse.json(
    {
      error: 'gone',
      hint: 'Savings fee is metered in /api/proxy when a hop has verified savings.'
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/proxy/{provider}/…',
    note: 'Meter api_proxy_usage fires on verified savings only. No save → no fee.'
  });
}
