import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getPaidPlan, siteUrl, PLANS } from '@/lib/billing';

/**
 * Stripe Checkout for GateZero paid plans.
 * Prefer STRIPE_PRICE_* from env; falls back to price_data.
 * Never receives vault secrets or API keys.
 */
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: 'STRIPE_SECRET_KEY not configured' },
      { status: 503 }
    );
  }

  let body: { plan?: string; email?: string; workspaceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const plan = getPaidPlan(body.plan || '');
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
              description: `${plan.takeRate}% of verified savings (0 if 0)`
            }
          }
        };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: body.email || undefined,
      line_items: [lineItem],
      // {CHECKOUT_SESSION_ID} is replaced by Stripe so we can resolve customer on return
      success_url: `${origin}/dashboard?checkout=success&plan=${plan.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=cancel`,
      metadata: {
        gatezero_plan: plan.id,
        gatezero_workspace: body.workspaceId || '',
        take_rate: String(plan.takeRate)
      },
      subscription_data: {
        metadata: {
          gatezero_plan: plan.id,
          gatezero_workspace: body.workspaceId || '',
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

/** Resolve Checkout session → customer id (for Billing portal after success). */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');

  if (sessionId && stripe) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const customerId =
        typeof session.customer === 'string'
          ? session.customer
          : session.customer && 'id' in session.customer
            ? (session.customer as { id: string }).id
            : null;
      return NextResponse.json({
        id: session.id,
        status: session.status,
        customerId,
        plan: session.metadata?.gatezero_plan || null
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: 'session lookup failed', detail: message }, { status: 502 });
    }
  }

  return NextResponse.json({
    plans: Object.values(PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      monthlyUsd: p.amountCents / 100,
      takeRate: p.takeRate,
      hasPriceId: !!p.priceId,
      entitlements: p.entitlements
    })),
    siteUrl: siteUrl()
  });
}
