import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { siteUrl } from '@/lib/billing';

/**
 * Stripe Customer Portal — manage subscription, invoices, cancel.
 * Body: { customerId: string } — never receives vault secrets.
 */
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: 'STRIPE_SECRET_KEY not configured' },
      { status: 503 }
    );
  }

  let body: { customerId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const customerId = body.customerId?.trim();
  if (!customerId || !customerId.startsWith('cus_')) {
    return NextResponse.json(
      { error: 'customerId (cus_...) required' },
      { status: 400 }
    );
  }

  const origin = siteUrl(req.headers.get('origin'));

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard?portal=return`
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'portal failed', detail: message },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/portal',
    method: 'POST',
    body: { customerId: 'cus_xxx' },
    note: 'Opens Stripe Customer Portal. Never send API keys here.'
  });
}
