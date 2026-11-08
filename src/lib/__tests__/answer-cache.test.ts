import { describe, expect, it } from '@jest/globals';

import { answerCache } from '../answer-cache';

describe('answerCache', () => {
  it('gives an account back its own answer', () => {
    const cache = answerCache<string>();
    cache.set('ana', '2026-11', 'a good month');
    expect(cache.get('ana', '2026-11')).toBe('a good month');
  });

  it('never shows one account the answer given to another', () => {
    const cache = answerCache<string>();
    cache.set('ana', '2026-11', 'a good month');
    expect(cache.get('ben', '2026-11')).toBeUndefined();
    cache.set('ben', '2026-11', 'a tight month');
    expect(cache.get('ana', '2026-11')).toBe('a good month');
    expect(cache.get('ben', '2026-11')).toBe('a tight month');
  });

  it('keeps different questions apart for one account', () => {
    const cache = answerCache<string>();
    cache.set('ana', 'earbuds|5000|2026-11', 'wait');
    expect(cache.get('ana', 'earbuds|6000|2026-11')).toBeUndefined();
  });
});
