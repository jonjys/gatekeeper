import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

/**
 * Stripe Checkout for GateZero plans.
 * Never receives vault secrets or API keys.
 */
const PLANS: Record<
  string,
  { name: string; amountCents: number; takeRate: number; mode: 'subscription' }
> = {
  pro: { name: 'GateZero Pro', amountCents: 2900, takeRate: 2, mode: 'subscription' },
  enterprise: {
    name: 'GateZero Enterprise',
    amountCents: 29900,
    takeRate: 1,
    mode: 'subscription'
  }
};

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: 'STRIPE_SECRET_KEY not configured' },
      { status: 503 }
    );
  }

  let body: { plan?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const planKey = (body.plan || '').toLowerCase();
  const plan = PLANS[planKey];
  if (!plan) {
    return NextResponse.json(
      { error: 'plan must be pro or enterprise' },
      { status: 400 }
    );
  }

  const origin = req.headers.get('origin') || 'https://gatezero.app';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: body.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: plan.amountCents,
            recurring: { interval: 'month' },
            product_data: {
              name: plan.name,
              description: `${plan.takeRate}% take-rate on proxied API spend`
            }
          }
        }
      ],
      success_url: `${origin}/dashboard?checkout=success&plan=${planKey}`,
      cancel_url: `${origin}/pricing?checkout=cancel`,
      metadata: {
        gatezero_plan: planKey,
        take_rate: String(plan.takeRate)
      }
    });

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'checkout failed', detail: message }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({
    plans: Object.entries(PLANS).map(([id, p]) => ({
      id,
      name: p.name,
      monthlyUsd: p.amountCents / 100,
      takeRate: p.takeRate
    })),
    free: { id: 'free', monthlyUsd: 0, takeRate: 2 }
  });
}
