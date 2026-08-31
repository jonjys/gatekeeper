import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

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
  if (event.type === 'checkout.session.completed' && db) {
    const session = event.data.object as {
      customer?: string;
      metadata?: { gatezero_workspace?: string; gatezero_plan?: string };
    };
    const ws = session.metadata?.gatezero_workspace;
    if (ws && session.customer) {
      await db
        .from('workspaces')
        .update({
          stripe_customer_id: String(session.customer),
          plan: session.metadata?.gatezero_plan || 'pro'
        })
        .eq('id', ws);
    }
  }
  if (event.type === 'customer.subscription.deleted' && db) {
    const sub = event.data.object as { customer?: string };
    if (sub.customer) {
      await db
        .from('workspaces')
        .update({ plan: 'free' })
        .eq('stripe_customer_id', String(sub.customer));
    }
  }
  if ((event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') && db) {
    const inv = event.data.object as { id?: string; customer?: string; amount_paid?: number };
    await db.from('billing_ledger').insert({
      stripe_event_id: event.id,
      stripe_customer_id: inv.customer ? String(inv.customer) : null,
      amount_cents: inv.amount_paid || 0,
      kind: 'invoice.paid'
    });
  }
  return NextResponse.json({ received: true, type: event.type });
}
