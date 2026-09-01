import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { siteUrl } from '@/lib/billing';
import { requireWorkspace } from '@/lib/engine/auth';

/**
 * Stripe Customer Portal for the workspace on x-gz-key.
 * Never accepts a raw cus_ from the client.
 */
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 503 });
  }

  const auth = await requireWorkspace(req);
  if ('error' in auth) return auth.error;
  const customerId = auth.ws.stripe_customer_id;
  if (!customerId || !customerId.startsWith('cus_')) {
    return NextResponse.json(
      { error: 'no_customer', hint: 'Upgrade on /pricing first. Billing opens after Checkout.' },
      { status: 400 }
    );
  }

  const origin = siteUrl(req.headers.get('origin'));
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/start?portal=return`
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'portal failed', detail: message }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/portal',
    method: 'POST',
    headers: { 'x-gz-key': 'gz_live_…' }
  });
}
