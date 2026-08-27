import { NextRequest } from 'next/server';
import { handleProxy } from '@/lib/engine/proxy-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handle(req: NextRequest, ctx: { params: { provider: string } }) {
  return handleProxy(req, ctx.params.provider, []);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
