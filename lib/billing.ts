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

const FREE_ENTS: Entitlement[] = ['vault', 'cost_radar'];
const PRO_ENTS: Entitlement[] = [
  ...FREE_ENTS,
  'passkeys',
  'yubigate',
  'audit',
  'csv_export',
  'priority_proxy',
  'portal'
];
const ENT_ENTS: Entitlement[] = [
  ...PRO_ENTS,
  'team_seats',
  'sso',
  'custom_take'
];

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    amountCents: 0,
    takeRate: 2,
    priceId: null,
    entitlements: FREE_ENTS
  },
  pro: {
    id: 'pro',
    name: 'GateZero Pro',
    amountCents: 2900,
    takeRate: 2,
    priceId: process.env.STRIPE_PRICE_PRO || null,
    entitlements: PRO_ENTS,
    highlight: true
  },
  enterprise: {
    id: 'enterprise',
    name: 'GateZero Enterprise',
    amountCents: 29900,
    takeRate: 1,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || null,
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
    'https://gatezero.app'
  ).replace(/\/$/, '');
}

/** Take-rate for a plan (percent points, e.g. 2) */
export function takeRateFor(planId: PlanId | string | null | undefined): number {
  return getPlan(String(planId || 'free'))?.takeRate ?? 2;
}
