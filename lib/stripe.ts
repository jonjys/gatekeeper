import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;

export const stripe = secret
  ? new Stripe(secret, { apiVersion: '2023-10-16' })
  : null;

/** Metered take-rate — server only. Keys never touch this module.
 * Stripe Billing Meter event_name must be: api_proxy_usage
 * Aggregation: Sum · Customer key: stripe_customer_id
 * Value = take cents (costUsd * takeRate * 100)
 */
export async function recordMeteredUsage(customerId: string, costUsd: number) {
  if (!stripe || !customerId) return;
  const cents = Math.round(costUsd * 0.02 * 100);
  if (cents < 1) return;
  try {
    await stripe.billing.meterEvents.create({
      event_name: 'api_proxy_usage',
      timestamp: Math.floor(Date.now() / 1000),
      payload: {
        stripe_customer_id: customerId,
        value: String(cents)
      }
    } as Stripe.Billing.MeterEventCreateParams);
  } catch (e) {
    console.error('metered usage', e);
  }
}
