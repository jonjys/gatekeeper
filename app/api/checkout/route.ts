import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getPaidPlan, siteUrl, PLANS, savingsFeeBpsForPlan } from '@/lib/billing';
import { isGzToken, readGzToken, requireWorkspace } from '@/lib/engine/auth';
import { jsonError } from '@/lib/engine/errors';
import { updateWorkspace } from '@/lib/engine/workspace';

/**
 * Stripe Checkout for GateZero paid plans.
 * Requires x-gz-key so the session binds to a real workspace.
 * Prefer STRIPE_PRICE_* from env; falls back to price_data.
 * Never receives vault secrets or API keys.
 */
export async function POST(req: NextRequest) {
  if (!stripe) {
    return jsonError('stripe_unconfigured', 503, { hint: 'Set STRIPE_SECRET_KEY' });
  }

  const auth = await requireWorkspace(req);
  if ('error' in auth) {
    return jsonError('missing_workspace', 401, {
      hint: 'Create a workspace on /start first, then upgrade. Send x-gz-key.'
    });
  }

  let body: { plan?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('invalid_json', 400);
  }

  const plan = getPaidPlan(body.plan || '');
  if (!plan) {
    return jsonError('invalid_plan', 400, { hint: 'plan must be pro or enterprise' });
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
      ...(auth.ws.stripe_customer_id
        ? { customer: auth.ws.stripe_customer_id }
        : body.email
          ? { customer_email: body.email }
          : {}),
      line_items: [lineItem],
      success_url: `${origin}/start?checkout=success&plan=${plan.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=cancel`,
      metadata: {
        gatezero_plan: plan.id,
        gatezero_workspace: auth.ws.id,
        take_rate: String(plan.takeRate)
      },
      subscription_data: {
        metadata: {
          gatezero_plan: plan.id,
          gatezero_workspace: auth.ws.id,
          take_rate: String(plan.takeRate)
        }
      }
    });

    return NextResponse.json({
      url: session.url,
      id: session.id,
      usedPriceId: !!plan.priceId,
      workspaceId: auth.ws.id
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonError('checkout_failed', 502, { detail: message });
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
      const plan = session.metadata?.gatezero_plan || null;
      let bound = false;
      if (isGzToken(readGzToken(req)) && customerId) {
        const auth = await requireWorkspace(req);
        if (!('error' in auth)) {
          await updateWorkspace(auth.ws.id, {
            stripe_customer_id: customerId,
            plan: plan || auth.ws.plan,
            savings_fee_bps: savingsFeeBpsForPlan(plan || auth.ws.plan)
          });
          bound = true;
        }
      }
      return NextResponse.json({
        id: session.id,
        status: session.status,
        customerId,
        plan,
        bound
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return jsonError('session_lookup_failed', 502, { detail: message });
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
    siteUrl: siteUrl(),
    note: 'POST /api/checkout with x-gz-key to start a paid plan.'
  });
}
