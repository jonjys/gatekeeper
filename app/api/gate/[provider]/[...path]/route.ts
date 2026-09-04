import { NextRequest } from 'next/server';
import { jsonError } from '@/lib/engine/errors';

/** Leftover demo path. The spend router is /api/proxy — not the Service Worker. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { provider: string; path: string[] } }
) {
  return jsonError('demo_path', 503, {
    message: `Use /api/proxy/${params.provider}/${(params.path || []).join('/') || '…'} with x-gz-key. /api/gate is a leftover Service Worker demo, not the money path.`
  });
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
