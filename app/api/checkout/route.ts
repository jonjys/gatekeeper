import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getPlan, siteUrl, PLANS } from '@/lib/billing';

/**
 * Stripe Checkout for GateZero plans.
 * Prefer STRIPE_PRICE_PRO / STRIPE_PRICE_ENTERPRISE from env.
 * Falls back to ad-hoc price_data if Price IDs not set.
 * Never receives vault secrets or API keys.
 */
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

  const plan = getPlan(body.plan || '');
  if (!plan) {
    return NextResponse.json(
      { error: 'plan must be pro or enterprise' },
      { status: 400 }
    );
  }

  const origin = siteUrl(req.headers.get('origin'));

  try {
    const lineItem = plan.priceId
      ? { price: plan.priceId, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: 'usd' as const,
            unit_amount: plan.amountCents,
            recurring: { interval: 'month' as const },
            product_data: {
              name: plan.name,
              description: `${plan.takeRate}% take-rate on proxied API spend`
            }
          }
        };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: body.email || undefined,
      line_items: [lineItem],
      success_url: `${origin}/dashboard?checkout=success&plan=${plan.id}`,
      cancel_url: `${origin}/pricing?checkout=cancel`,
      metadata: {
        gatezero_plan: plan.id,
        take_rate: String(plan.takeRate)
      },
      subscription_data: {
        metadata: {
          gatezero_plan: plan.id,
          take_rate: String(plan.takeRate)
        }
      }
    });

    return NextResponse.json({
      url: session.url,
      id: session.id,
      usedPriceId: !!plan.priceId
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'checkout failed', detail: message },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    plans: Object.values(PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      monthlyUsd: p.amountCents / 100,
      takeRate: p.takeRate,
      hasPriceId: !!p.priceId
    })),
    free: { id: 'free', monthlyUsd: 0, takeRate: 2 },
    siteUrl: siteUrl()
  });
}
