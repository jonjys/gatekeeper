import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { siteUrl } from '@/lib/billing';
import { jsonError } from '@/lib/engine/errors';
import { requireWorkspace } from '@/lib/engine/auth';

/**
 * Stripe Customer Portal for the workspace on x-gz-key.
 * Never accepts a raw cus_ from the client.
 */
export async function POST(req: NextRequest) {
  if (!stripe) {
    return jsonError('stripe_unconfigured', 503, { hint: 'Set STRIPE_SECRET_KEY' });
  }

  const auth = await requireWorkspace(req);
  if ('error' in auth) return auth.error;
  const customerId = auth.ws.stripe_customer_id;
  if (!customerId || !customerId.startsWith('cus_')) {
    return jsonError('no_customer', 400, {
      hint: 'Upgrade on /pricing first. Billing opens after Checkout.'
    });
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
    return jsonError('portal_failed', 502, { detail: message });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/portal',
    method: 'POST',
    headers: { 'x-gz-key': 'gz_live_…' }
  });
}
