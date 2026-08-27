import { findPrice } from './prices';

export type RouteDecision = {
  requestedModel: string;
  routedModel: string;
  action: 'passthrough' | 'cheaper_alias' | 'blocked';
  reason: string;
};

export function decideRoute(opts: {
  provider: string;
  requestedModel: string;
  preferCheap: boolean;
  killed: boolean;
}): RouteDecision {
  if (opts.killed) {
    return {
      requestedModel: opts.requestedModel,
      routedModel: opts.requestedModel,
      action: 'blocked',
      reason: 'kill_switch'
    };
  }
  const row = findPrice(opts.provider, opts.requestedModel);
  if (opts.preferCheap && row?.cheaperAlias) {
    return {
      requestedModel: opts.requestedModel,
      routedModel: row.cheaperAlias,
      action: 'cheaper_alias',
      reason: `alias ${row.model} -> ${row.cheaperAlias}`
    };
  }
  return {
    requestedModel: opts.requestedModel || 'unknown',
    routedModel: opts.requestedModel || 'unknown',
    action: 'passthrough',
    reason: 'no_cheaper_alias'
  };
}

export function applyModelToBody(raw: string, routedModel: string): string {
  if (!raw || !routedModel) return raw;
  try {
    const j = JSON.parse(raw) as { model?: string };
    if (j && typeof j === 'object' && j.model && j.model !== routedModel) {
      j.model = routedModel;
      return JSON.stringify(j);
    }
  } catch {
    /* not json */
  }
  return raw;
}

export function extractModel(raw: string): string {
  try {
    const j = JSON.parse(raw) as { model?: string };
    if (j?.model) return String(j.model);
  } catch {
    /* ignore */
  }
  return '';
}
