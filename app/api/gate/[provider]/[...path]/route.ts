import { NextRequest, NextResponse } from 'next/server';

/** Catch-all fallback. SW owns the real path. Zero keys here. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { provider: string; path: string[] } }
) {
  return NextResponse.json(
    {
      error: 'Use Service Worker proxy at /api/gate/[provider]',
      message: 'Keys never leave the machine. Ensure SW is registered (HTTPS or localhost).',
      provider: params.provider,
      path: (params.path || []).join('/')
    },
    { status: 503 }
  );
}

export async function POST(
  req: NextRequest,
  ctx: { params: { provider: string; path: string[] } }
) {
  return GET(req, ctx);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: { provider: string; path: string[] } }
) {
  return GET(req, ctx);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { provider: string; path: string[] } }
) {
  return GET(req, ctx);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { provider: string; path: string[] } }
) {
  return GET(req, ctx);
}
