import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { AIError, createClaude, MODEL } from '../src/ai/claude';

function fakeClient(result: Partial<{ stop_reason: string; parsed_output: unknown }> | Error) {
  const parse = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return { stop_reason: 'end_turn', parsed_output: null, ...result };
  });
  return { client: { messages: { parse } } as unknown as Anthropic, parse };
}

const scan = { image_base64: 'abc', media_type: 'image/jpeg' as const, currency: 'USD', locale: 'en-US', today: '2026-10-23' };

describe('createClaude', () => {
  it('sends the image with low effort and a structured-output format', async () => {
    const { client, parse } = fakeClient({ parsed_output: { ok: true } });
    await createClaude('k', client).scanReceipt(scan);
    const params = (parse.mock.calls[0] as unknown[])[0] as Record<string, any>;
    expect(params.model).toBe(MODEL);
    expect(MODEL).toBe('claude-haiku-5-5');
    expect(params.output_config.effort).toBe('low');
    expect(params.output_config.format).toBeDefined();
    expect(params.messages[0].content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'abc' } });
    expect(params.messages[0].content[1].text).toContain('2026-10-23');
  });

  it('maps a refusal to a friendly 422', async () => {
    const { client } = fakeClient({ stop_reason: 'refusal' });
    await expect(createClaude('k', client).scanReceipt(scan)).rejects.toMatchObject({ status: 422, code: 'ai_declined' });
  });

  it('maps max_tokens to a 422 asking for a shorter photo', async () => {
    const { client } = fakeClient({ stop_reason: 'max_tokens' });
    await expect(createClaude('k', client).scanReceipt(scan)).rejects.toMatchObject({ code: 'too_long' });
  });

  it('treats a missing parsed output as a parse failure', async () => {
    const { client } = fakeClient({ parsed_output: null });
    await expect(createClaude('k', client).checkPurchase({ item: 'x', price: 1, currency: 'USD' })).rejects.toBeInstanceOf(AIError);
  });

  it('maps API rate limits to 503', async () => {
    const err = new Anthropic.RateLimitError(429, { type: 'error', error: { type: 'rate_limit_error', message: 'slow' } }, 'slow', new Headers());
    const { client } = fakeClient(err);
    await expect(createClaude('k', client).monthlyReview({} as never)).rejects.toMatchObject({ status: 503, code: 'ai_busy' });
  });
});
