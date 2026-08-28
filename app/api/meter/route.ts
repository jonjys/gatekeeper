import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

/**
 * Stripe metered savings-fee test endpoint (20% of verified savings).
 * Accepts only metadata: customerId + costUsd.
 * Never receives API keys or vault secrets.
 */
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: 'STRIPE_SECRET_KEY not configured on server' },
      { status: 503 }
    );
  }

  let body: { customerId?: string; costUsd?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const customerId = body.customerId?.trim();
  const costUsd = Number(body.costUsd);
  if (!customerId || !Number.isFinite(costUsd) || costUsd < 0) {
    return NextResponse.json(
      { error: 'customerId (string) and costUsd (number ≥ 0) required' },
      { status: 400 }
    );
  }

  const takeRate = 0.02;
  const cents = Math.round(costUsd * takeRate * 100);
  if (cents < 1) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'sub-cent after savings fee',
      costUsd,
      takeUsd: costUsd * takeRate
    });
  }

  try {
    const event = await stripe.billing.meterEvents.create({
      event_name: 'api_proxy_usage',
      timestamp: Math.floor(Date.now() / 1000),
      payload: {
        stripe_customer_id: customerId,
        value: String(cents)
      }
    } as Parameters<typeof stripe.billing.meterEvents.create>[0]);

    return NextResponse.json({
      ok: true,
      takeRate,
      costUsd,
      takeUsd: costUsd * takeRate,
      cents,
      identifier: event.identifier
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'meter event failed', detail: message }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/meter',
    method: 'POST',
    body: { customerId: 'cus_xxx', costUsd: 10.5 },
    note: 'Records savings-fee meter event. Never send API keys here.'
  });
}
