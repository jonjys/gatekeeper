import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;

export const stripe = secret
  ? new Stripe(secret, { apiVersion: '2023-10-16' })
  : null;

/** Metered 2% take-rate — server only. Keys never touch this module. */
export async function recordMeteredUsage(customerId: string, costUsd: number) {
  if (!stripe || !customerId) return;
  const cents = Math.round(costUsd * 0.02 * 100);
  if (cents < 1) return;
  try {
    await stripe.billing.meterEvents.create({
      event_name: 'api_proxy_usage',
      payload: { stripe_customer_id: customerId, value: String(cents) }
    });
  } catch (e) {
    console.error('metered usage', e);
  }
}
