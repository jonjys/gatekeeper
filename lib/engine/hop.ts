/** Providers with cheaper-model routing + a price table. Stripe is passthrough only. */
export const ROUTABLE_PROVIDERS = ['openai', 'anthropic'] as const;
export type RoutableProvider = (typeof ROUTABLE_PROVIDERS)[number];

export function isRoutableProvider(provider: string): provider is RoutableProvider {
  return provider === 'openai' || provider === 'anthropic';
}

export function hopPath(provider: string): string {
  return provider === 'anthropic' ? 'v1/messages' : 'v1/chat/completions';
}

export function modelsPath(provider: string): string {
  return 'v1/models';
}

/** Requested model used by the /start prove hop. Alias target lives in the price table. */
export function proveRequestedModel(provider: string): string {
  return provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o';
}

export function cheapPassthroughModel(provider: string): string {
  return provider === 'anthropic' ? 'claude-3-5-haiku-20241022' : 'gpt-4o-mini';
}

export function hopSnippet(origin: string, provider: string, token: string): string {
  const p = isRoutableProvider(provider) ? provider : 'openai';
  return `${origin.replace(/\/$/, '')}/api/proxy/${p}/${hopPath(p)}\nx-gz-key: ${token || 'gz_live_…'}`;
}
