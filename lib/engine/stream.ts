import { applyModelToBody } from './route';

export function bodyWantsStream(raw: string): boolean {
  if (!raw) return false;
  try {
    const j = JSON.parse(raw) as { stream?: unknown };
    return j?.stream === true;
  } catch {
    return false;
  }
}

/** Rewrite model + ask OpenAI to include usage on the last SSE chunk. */
export function prepareOutboundBody(raw: string, routedModel: string, provider: string): string {
  let next = applyModelToBody(raw, routedModel);
  if (!next || provider !== 'openai') return next;
  try {
    const j = JSON.parse(next) as { stream?: boolean; stream_options?: Record<string, unknown> };
    if (j && j.stream === true) {
      j.stream_options = { ...(j.stream_options || {}), include_usage: true };
      return JSON.stringify(j);
    }
  } catch {
    /* not json */
  }
  return next;
}

export type StreamUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
};

/** Pull token usage from OpenAI / Anthropic SSE tails. */
export function parseSseUsage(text: string): StreamUsage | undefined {
  if (!text) return undefined;
  let prompt = 0;
  let completion = 0;
  let found = false;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const json = trimmed.slice(5).trim();
    if (!json || json === '[DONE]') continue;
    try {
      const j = JSON.parse(json) as {
        usage?: StreamUsage;
        type?: string;
        message?: { usage?: StreamUsage };
      };
      if (j.usage) {
        found = true;
        prompt = Number(j.usage.prompt_tokens ?? j.usage.input_tokens ?? prompt) || prompt;
        completion = Number(j.usage.completion_tokens ?? j.usage.output_tokens ?? completion) || completion;
      }
      if (j.type === 'message_start' && j.message?.usage) {
        found = true;
        prompt = Number(j.message.usage.input_tokens ?? j.message.usage.prompt_tokens ?? prompt) || prompt;
      }
      if (j.type === 'message_delta' && j.usage) {
        found = true;
        completion = Number(j.usage.output_tokens ?? j.usage.completion_tokens ?? completion) || completion;
      }
    } catch {
      /* ignore partial SSE */
    }
  }
  if (!found) return undefined;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    input_tokens: prompt,
    output_tokens: completion
  };
}
