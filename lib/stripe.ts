import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;

export const stripe = secret
  ? new Stripe(secret, { apiVersion: '2023-10-16' })
  : null;

/** Record verified-savings fee in cents on meter api_proxy_usage. */
export async function recordSavingsFee(customerId: string, feeUsd: number) {
  if (!stripe || !customerId) return;
  const cents = Math.round(feeUsd * 100);
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
