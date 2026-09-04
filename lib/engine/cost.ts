import {
  costUsd,
  estimateTokensFromChars,
  feeFromSavingsUsd,
  findPrice,
  round6,
  type PriceRow
} from './prices';

export type CostInput = {
  provider: string;
  requestedModel: string;
  routedModel: string;
  promptTokens: number;
  completionTokens: number;
  savingsFeeBps: number;
};

export type CostResult = {
  baselineUsd: number;
  actualUsd: number;
  savingsUsd: number;
  feeUsd: number;
  requestedModel: string;
  routedModel: string;
  priceFound: boolean;
};

export function computeCost(input: CostInput): CostResult {
  const baselineRow = findPrice(input.provider, input.requestedModel);
  const actualRow = findPrice(input.provider, input.routedModel) || baselineRow;
  const pt = input.promptTokens;
  const ct = input.completionTokens;
  const baselineUsd = baselineRow ? costUsd(baselineRow, pt, ct) : 0;
  const actualUsd = actualRow ? costUsd(actualRow, pt, ct) : baselineUsd;
  const savingsUsd = round6(Math.max(0, baselineUsd - actualUsd));
  const feeUsd = feeFromSavingsUsd(savingsUsd, input.savingsFeeBps);
  return {
    baselineUsd,
    actualUsd,
    savingsUsd,
    feeUsd,
    requestedModel: input.requestedModel,
    routedModel: input.routedModel,
    priceFound: Boolean(baselineRow || actualRow)
  };
}

/** Failed hops must not invent savings or a Stripe take. */
export function costForCompletedHop(upstreamOk: boolean, cost: CostResult): CostResult {
  if (upstreamOk) return cost;
  return {
    ...cost,
    baselineUsd: 0,
    actualUsd: 0,
    savingsUsd: 0,
    feeUsd: 0
  };
}

export function tokensFromBodyAndUsage(
  bodyText: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number }
): { promptTokens: number; completionTokens: number } {
  if (usage) {
    const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
    const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
    if (promptTokens > 0 || completionTokens > 0) {
      return { promptTokens, completionTokens };
    }
  }
  const n = estimateTokensFromChars(bodyText.length);
  return { promptTokens: n, completionTokens: Math.ceil(n * 0.3) };
}

export type { PriceRow };
