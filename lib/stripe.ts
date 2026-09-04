import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;

export const stripe = secret
  ? new Stripe(secret, { apiVersion: '2023-10-16' })
  : null;

/** Record verified-savings fee in cents on meter api_proxy_usage. Identifier is idempotent. */
export async function recordSavingsFee(
  customerId: string,
  feeUsd: number,
  identifier?: string
) {
  if (!stripe || !customerId) return { ok: false as const, skipped: 'unconfigured' };
  const cents = Math.round(feeUsd * 100);
  if (cents < 1) return { ok: false as const, skipped: 'sub_cent' };
  try {
    const params: Stripe.Billing.MeterEventCreateParams = {
      event_name: 'api_proxy_usage',
      timestamp: Math.floor(Date.now() / 1000),
      payload: {
        stripe_customer_id: customerId,
        value: String(cents)
      }
    };
    if (identifier) params.identifier = identifier.slice(0, 100);
    await stripe.billing.meterEvents.create(params);
    return { ok: true as const };
  } catch (e) {
    console.error('metered usage', e);
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}
