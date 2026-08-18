import { NextResponse } from 'next/server';

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.openai.com https://api.anthropic.com",
  "img-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  // Allow fred-platform /core/gatezero to iframe /gate
  "frame-ancestors 'self' https://fred-platform.vercel.app"
].join('; ');

export function middleware() {
  const res = NextResponse.next();
  res.headers.set('Content-Security-Policy', CSP);
  res.headers.set(
    'Permissions-Policy',
    'locks=(self), compute-pressure=(self), clipboard-read=(self), usb=(self)'
  );
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Do not set X-Frame-Options — CSP frame-ancestors is the allow-list
  res.headers.delete('X-Frame-Options');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icon-512.png).*)']
};
