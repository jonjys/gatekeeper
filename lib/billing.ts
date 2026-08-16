/**
 * GateZero billing config.
 * Prefer Stripe Price IDs from env (production).
 * Falls back to price_data for local/dev without Dashboard products.
 * Never touches vault secrets or API keys.
 */

export type PlanId = 'pro' | 'enterprise';

export type PlanConfig = {
  id: PlanId;
  name: string;
  amountCents: number;
  takeRate: number;
  /** Stripe Price ID from Dashboard — set via env */
  priceId: string | null;
};

export const PLANS: Record<PlanId, PlanConfig> = {
  pro: {
    id: 'pro',
    name: 'GateZero Pro',
    amountCents: 2900,
    takeRate: 2,
    priceId: process.env.STRIPE_PRICE_PRO || null
  },
  enterprise: {
    id: 'enterprise',
    name: 'GateZero Enterprise',
    amountCents: 29900,
    takeRate: 1,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || null
  }
};

export function getPlan(planKey: string): PlanConfig | null {
  const key = planKey.toLowerCase() as PlanId;
  return PLANS[key] ?? null;
}

/** Site origin for Checkout success/cancel URLs */
export function siteUrl(reqOrigin?: string | null): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    reqOrigin ||
    'https://gatezero.app'
  ).replace(/\/$/, '');
}
