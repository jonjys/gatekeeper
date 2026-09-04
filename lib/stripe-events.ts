import { adminDb } from '@/lib/supabase-admin';
import { resolvePlanFromSubscription, savingsFeeBpsForPlan, type PlanId } from '@/lib/billing';

export async function bindWorkspacePlan(
  workspaceId: string,
  customerId: string | null | undefined,
  plan: string | null | undefined
) {
  const db = adminDb();
  if (!db || !workspaceId) return { ok: false as const, reason: 'no_db_or_workspace' };
  const patch: Record<string, unknown> = {};
  if (customerId) patch.stripe_customer_id = String(customerId);
  if (plan) {
    patch.plan = plan;
    patch.savings_fee_bps = savingsFeeBpsForPlan(plan);
  }
  if (!Object.keys(patch).length) return { ok: false as const, reason: 'empty_patch' };
  const { error } = await db.from('workspaces').update(patch).eq('id', workspaceId);
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const };
}

export async function bindPlanByCustomer(
  customerId: string,
  plan: PlanId,
  extra?: { stripe_customer_id?: string }
) {
  const db = adminDb();
  if (!db || !customerId) return { ok: false as const };
  const patch: Record<string, unknown> = {
    plan,
    savings_fee_bps: savingsFeeBpsForPlan(plan)
  };
  if (extra?.stripe_customer_id) patch.stripe_customer_id = extra.stripe_customer_id;
  const { error } = await db.from('workspaces').update(patch).eq('stripe_customer_id', customerId);
  if (error) return { ok: false as const };
  return { ok: true as const };
}

export function customerIdFromStripe(obj: { customer?: unknown }): string | null {
  const c = obj.customer;
  if (typeof c === 'string' && c.startsWith('cus_')) return c;
  if (c && typeof c === 'object' && 'id' in c && typeof (c as { id: unknown }).id === 'string') {
    const id = (c as { id: string }).id;
    return id.startsWith('cus_') ? id : null;
  }
  return null;
}

export async function applySubscriptionToWorkspace(sub: {
  customer?: unknown;
  status?: string | null;
  metadata?: { gatezero_workspace?: string; gatezero_plan?: string } | null;
  items?: { data?: Array<{ price?: { id?: string } | string | null }> } | null;
}) {
  const customerId = customerIdFromStripe(sub);
  const resolved = resolvePlanFromSubscription(sub);
  const ws = sub.metadata?.gatezero_workspace;
  if (ws) {
    await bindWorkspacePlan(ws, customerId, resolved.plan);
  }
  if (customerId) {
    await bindPlanByCustomer(customerId, resolved.plan);
  }
  return { plan: resolved.plan, customerId, canceled: resolved.canceled };
}
