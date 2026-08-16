import { NextResponse } from 'next/server';

export function middleware() {
  const res = NextResponse.next();
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.openai.com https://api.anthropic.com; img-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'"
  );
  res.headers.set(
    'Permissions-Policy',
    'locks=(self), compute-pressure=(self), clipboard-read=(self)'
  );
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icon-512.png).*)']
};
