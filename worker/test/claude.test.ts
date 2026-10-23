import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { createClaude, MODEL } from '../src/ai/claude';

type Final = Partial<{ stop_reason: string; parsed_output: unknown }> | Error;

/** Mimics messages.stream(): returns a stream whose finalMessage() resolves (or rejects) per call. */
function fakeClient(...results: Final[]) {
  let call = 0;
  const stream = vi.fn(() => {
    const result = results[Math.min(call++, results.length - 1)];
    return {
      finalMessage: async () => {
        if (result instanceof Error) throw result;
        return { stop_reason: 'end_turn', parsed_output: null, ...result };
      },
    };
  });
  return { client: { messages: { stream } } as unknown as Anthropic, stream };
}

const scan = { image_base64: 'abc', media_type: 'image/jpeg' as const, currency: 'USD', locale: 'en-US', today: '2026-10-23' };

describe('createClaude', () => {
  it('streams the image at max effort with a structured-output format', async () => {
    const { client, stream } = fakeClient({ parsed_output: { ok: true } });
    await createClaude('k', client).scanReceipt(scan);
    const [params, options] = stream.mock.calls[0] as unknown as [Record<string, any>, { signal: AbortSignal }];
    expect(params.model).toBe(MODEL);
    expect(MODEL).toBe('claude-haiku-5-5');
    expect(params.output_config.effort).toBe('max');
    expect(params.max_tokens).toBe(32_000);
    expect(params.output_config.format).toBeDefined();
    expect(options.signal).toBeInstanceOf(AbortSignal);
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

  it('asks once more when the answer comes back empty, then gives up', async () => {
    const answer = { necessity: 'want', verdict: 'go', reason: 'ok', cheaper_alternative: null, questions: [] };
    const retried = fakeClient({ parsed_output: null }, { parsed_output: answer });
    await expect(createClaude('k', retried.client).checkPurchase({ item: 'x', price: 1, currency: 'USD' })).resolves.toEqual(answer);
    expect(retried.stream).toHaveBeenCalledTimes(2);

    const empty = fakeClient({ parsed_output: null });
    await expect(createClaude('k', empty.client).checkPurchase({ item: 'x', price: 1, currency: 'USD' })).rejects.toMatchObject({
      code: 'ai_parse_failed',
    });
    expect(empty.stream).toHaveBeenCalledTimes(2);
  });

  it('maps a user abort (deadline) to a 504', async () => {
    const { client } = fakeClient(new Anthropic.APIUserAbortError());
    await expect(createClaude('k', client).scanReceipt(scan)).rejects.toMatchObject({ status: 504, code: 'ai_timeout' });
  });

  it('maps API rate limits to 503', async () => {
    const err = new Anthropic.RateLimitError(429, { type: 'error', error: { type: 'rate_limit_error', message: 'slow' } }, 'slow', new Headers());
    const { client } = fakeClient(err);
    await expect(createClaude('k', client).monthlyReview({} as never)).rejects.toMatchObject({ status: 503, code: 'ai_busy' });
  });
});
