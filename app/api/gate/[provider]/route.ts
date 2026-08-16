import { NextRequest, NextResponse } from 'next/server';

/** Fallback only. Real proxy is Service Worker. This route never sees keys. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { provider: string } }
) {
  return NextResponse.json(
    {
      error: 'Use Service Worker proxy at /api/gate/[provider]',
      message: 'Keys never leave the machine. Reload so SW controls this origin.',
      provider: params.provider
    },
    { status: 503 }
  );
}

export async function POST(
  req: NextRequest,
  ctx: { params: { provider: string } }
) {
  return GET(req, ctx);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: { provider: string } }
) {
  return GET(req, ctx);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { provider: string } }
) {
  return GET(req, ctx);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { provider: string } }
) {
  return GET(req, ctx);
}
