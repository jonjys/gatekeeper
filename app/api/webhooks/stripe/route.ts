import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/supabase-admin';
import { savingsFeeBpsForPlan } from '@/lib/billing';
import { isUniqueViolation } from '@/lib/engine/proxy-utils';

export const dynamic = 'force-dynamic';

async function bindWorkspacePlan(
  workspaceId: string,
  customerId: string | null | undefined,
  plan: string | null | undefined
) {
  const db = adminDb();
  if (!db || !workspaceId) return;
  const patch: Record<string, unknown> = {};
  if (customerId) patch.stripe_customer_id = String(customerId);
  if (plan) {
    patch.plan = plan;
    patch.savings_fee_bps = savingsFeeBpsForPlan(plan);
  }
  if (!Object.keys(patch).length) return;
  await db.from('workspaces').update(patch).eq('id', workspaceId);
}

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'stripe_unconfigured' }, { status: 503 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'missing_webhook_secret' }, { status: 503 });
  const raw = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'no_signature' }, { status: 400 });
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'bad_sig';
    return NextResponse.json({ error: 'invalid_signature', detail: message }, { status: 400 });
  }
  const db = adminDb();
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      customer?: string;
      metadata?: { gatezero_workspace?: string; gatezero_plan?: string };
    };
    const ws = session.metadata?.gatezero_workspace;
    if (ws && session.customer) {
      await bindWorkspacePlan(ws, String(session.customer), session.metadata?.gatezero_plan || 'pro');
    }
  }
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as { customer?: string };
    if (sub.customer && db) {
      await db
        .from('workspaces')
        .update({ plan: 'free', savings_fee_bps: savingsFeeBpsForPlan('free') })
        .eq('stripe_customer_id', String(sub.customer));
    }
  }
  if ((event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') && db) {
    const inv = event.data.object as { id?: string; customer?: string; amount_paid?: number };
    const stripeEventId = inv.id || event.id;
    const { error } = await db.from('billing_ledger').insert({
      stripe_event_id: stripeEventId,
      stripe_customer_id: inv.customer ? String(inv.customer) : null,
      amount_cents: inv.amount_paid || 0,
      kind: 'invoice.paid'
    });
    if (error && !isUniqueViolation(error)) {
      console.error('billing_ledger', error.message, error.code);
    }
  }
  return NextResponse.json({ received: true, type: event.type });
}
