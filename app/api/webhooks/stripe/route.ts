import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/supabase-admin';
import { isUniqueViolation } from '@/lib/engine/proxy-utils';
import { jsonError } from '@/lib/engine/errors';
import {
  applySubscriptionToWorkspace,
  bindWorkspacePlan,
  customerIdFromStripe
} from '@/lib/stripe-events';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!stripe) return jsonError('stripe_unconfigured', 503);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return jsonError('missing_webhook_secret', 503);
  const raw = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return jsonError('no_signature', 400);
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'bad_sig';
    return jsonError('invalid_signature', 400, { detail: message });
  }
  const db = adminDb();
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      customer?: unknown;
      metadata?: { gatezero_workspace?: string; gatezero_plan?: string };
    };
    const ws = session.metadata?.gatezero_workspace;
    const customerId = customerIdFromStripe(session);
    if (ws && customerId) {
      await bindWorkspacePlan(ws, customerId, session.metadata?.gatezero_plan || 'pro');
    }
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
    const sub = event.data.object as {
      customer?: unknown;
      status?: string | null;
      metadata?: { gatezero_workspace?: string; gatezero_plan?: string } | null;
      items?: { data?: Array<{ price?: { id?: string } | string | null }> } | null;
    };
    await applySubscriptionToWorkspace(sub);
  }
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as {
      customer?: unknown;
      status?: string | null;
      metadata?: { gatezero_workspace?: string; gatezero_plan?: string } | null;
      items?: { data?: Array<{ price?: { id?: string } | string | null }> } | null;
    };
    await applySubscriptionToWorkspace({ ...sub, status: 'canceled' });
  }
  if ((event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') && db) {
    const inv = event.data.object as { id?: string; customer?: unknown; amount_paid?: number };
    const stripeEventId = inv.id || event.id;
    const { error } = await db.from('billing_ledger').insert({
      stripe_event_id: stripeEventId,
      stripe_customer_id: customerIdFromStripe(inv),
      amount_cents: inv.amount_paid || 0,
      kind: 'invoice.paid'
    });
    if (error && !isUniqueViolation(error)) {
      console.error('billing_ledger', error.message, error.code);
    }
  }
  return NextResponse.json({ received: true, type: event.type });
}
