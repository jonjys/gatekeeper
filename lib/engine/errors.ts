import { NextResponse } from 'next/server';

export type ApiErrorBody = {
  error: string;
  message?: string;
  hint?: string;
  detail?: string;
};

export function jsonError(
  error: string,
  status: number,
  extra?: Omit<ApiErrorBody, 'error'>
): NextResponse {
  const body: ApiErrorBody = { error };
  if (extra?.message) body.message = extra.message;
  if (extra?.hint) body.hint = extra.hint;
  if (extra?.detail) body.detail = extra.detail;
  return NextResponse.json(body, { status });
}
