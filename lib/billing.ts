/**
 * GateZero billing — 3 tiers + entitlements.
 * Prefer Stripe Price IDs from env. Never touches vault secrets.
 */

export type PlanId = 'free' | 'pro' | 'enterprise';

export type Entitlement =
  | 'vault'
  | 'cost_radar'
  | 'passkeys'
  | 'yubigate'
  | 'audit'
  | 'csv_export'
  | 'priority_proxy'
  | 'team_seats'
  | 'sso'
  | 'custom_take'
  | 'portal';

export type PlanConfig = {
  id: PlanId;
  name: string;
  amountCents: number;
  takeRate: number;
  priceId: string | null;
  entitlements: Entitlement[];
  highlight?: boolean;
};

const FREE_ENTS: Entitlement[] = ['vault'];
const PRO_ENTS: Entitlement[] = [...FREE_ENTS, 'priority_proxy', 'portal'];
const ENT_ENTS: Entitlement[] = [...PRO_ENTS, 'custom_take'];

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    amountCents: 0,
    takeRate: 20,
    priceId: null,
    entitlements: FREE_ENTS
  },
  pro: {
    id: 'pro',
    name: 'GateZero Pro',
    amountCents: 2900,
    takeRate: 20,
    priceId: process.env.STRIPE_PRICE_PRO || 'price_1U59ENBEo0YzuylweNsgp15c',
    entitlements: PRO_ENTS,
    highlight: true
  },
  enterprise: {
    id: 'enterprise',
    name: 'GateZero Enterprise',
    amountCents: 29900,
    takeRate: 15,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || 'price_1U59a6BEo0YzuylwSSGKkWlw',
    entitlements: ENT_ENTS
  }
};

export function getPlan(planKey: string): PlanConfig | null {
  const key = planKey.toLowerCase() as PlanId;
  return PLANS[key] ?? null;
}

/** Paid plans only (checkout targets) */
export function getPaidPlan(planKey: string): PlanConfig | null {
  const p = getPlan(planKey);
  if (!p || p.id === 'free') return null;
  return p;
}

export function hasEntitlement(
  planId: PlanId | string | null | undefined,
  feature: Entitlement
): boolean {
  const p = getPlan(String(planId || 'free'));
  if (!p) return false;
  return p.entitlements.includes(feature);
}

export function siteUrl(reqOrigin?: string | null): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    reqOrigin ||
    'https://getgatezero.com'
  ).replace(/\/$/, '');
}

/** Take-rate for a plan (percent of verified savings, e.g. 20). */
export function takeRateFor(planId: PlanId | string | null | undefined): number {
  return getPlan(String(planId || 'free'))?.takeRate ?? 20;
}

/** Workspace savings_fee_bps: 20% default, 15% Enterprise. */
export function savingsFeeBpsForPlan(planId: PlanId | string | null | undefined): number {
  return getPlan(String(planId || 'free'))?.takeRate === 15 ? 1500 : 2000;
}

export function planFromPriceId(priceId?: string | null): PlanId | null {
  if (!priceId) return null;
  if (priceId === PLANS.pro.priceId) return 'pro';
  if (priceId === PLANS.enterprise.priceId) return 'enterprise';
  return null;
}

export function isCanceledSubscriptionStatus(status?: string | null): boolean {
  return status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired';
}

/** Resolve GateZero plan from a Stripe subscription object. */
export function resolvePlanFromSubscription(sub: {
  status?: string | null;
  metadata?: { gatezero_plan?: string } | null;
  items?: { data?: Array<{ price?: { id?: string } | string | null }> } | null;
}): { plan: PlanId; canceled: boolean } {
  if (isCanceledSubscriptionStatus(sub.status)) {
    return { plan: 'free', canceled: true };
  }
  const meta = sub.metadata?.gatezero_plan;
  if (meta === 'pro' || meta === 'enterprise' || meta === 'free') {
    return { plan: meta, canceled: false };
  }
  const raw = sub.items?.data?.[0]?.price;
  const priceId = typeof raw === 'string' ? raw : raw?.id;
  return { plan: planFromPriceId(priceId) || 'pro', canceled: false };
}
