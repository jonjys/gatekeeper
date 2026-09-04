import { NextRequest, NextResponse } from 'next/server';
import { loadWorkspaceByToken, type Workspace } from './workspace';

export function isGzToken(token: string): boolean {
  return token.startsWith('gz_live_') || token.startsWith('gz_test_');
}

export function readGzToken(req: NextRequest): string {
  const h = req.headers.get('x-gz-key');
  if (h) return h.trim();
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer gz_')) return auth.slice(7).trim();
  return '';
}

export async function requireWorkspace(
  req: NextRequest
): Promise<{ ws: Workspace; token: string } | { error: NextResponse }> {
  const token = readGzToken(req);
  if (!isGzToken(token)) {
    return {
      error: NextResponse.json(
        { error: 'missing_workspace_token', hint: 'Send x-gz-key: gz_live_…' },
        { status: 401 }
      )
    };
  }
  const ws = await loadWorkspaceByToken(token);
  if (!ws) {
    return {
      error: NextResponse.json(
        {
          error: 'unknown_workspace',
          hint: 'Run supabase/migrations/003_engine.sql + 004_bridge.sql then POST /api/v1/workspace'
        },
        { status: 401 }
      )
    };
  }
  return { ws, token };
}
