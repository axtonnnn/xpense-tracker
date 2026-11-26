import { describe, expect, it } from '@jest/globals';

import { guessFromMerchant, type GuessState } from '../guess';

const start: GuessState = { category: 'groceries', necessity: 'need', guessedFrom: null, beforeGuess: null };

/** Types `name` one letter at a time, as the entry screen sees it. */
function typeOut(name: string, from: GuessState = start): GuessState {
  let s = from;
  for (let i = 1; i <= name.length; i++) s = guessFromMerchant(s, name.slice(0, i));
  return s;
}

describe('guessFromMerchant', () => {
  it('guesses from a name that matches', () => {
    expect(typeOut('Starbucks')).toMatchObject({ category: 'dining', necessity: 'want', guessedFrom: 'starbucks' });
  });

  it.each([
    ['Barnes & Noble', 'bar'],
    ['Spar', 'spa'],
    ['Business cards', 'bus'],
    ['Cabinet', 'cab'],
  ])('drops the guess "%s" passed through ("%s")', (name) => {
    expect(typeOut(name)).toEqual(start);
  });

  it('puts back what was picked before the guess, not the default', () => {
    const before: GuessState = { category: 'shopping', necessity: 'want', guessedFrom: null, beforeGuess: null };
    expect(typeOut('Barnes & Noble', before)).toEqual(before);
  });

  it('keeps the first earlier pick while the guess changes on the way', () => {
    // "Uber" → transport, "Uber Eats" → dining, then cleared: back to groceries.
    const eats = typeOut('Uber Eats');
    expect(eats).toMatchObject({ category: 'dining', beforeGuess: { category: 'groceries', necessity: 'need' } });
    expect(guessFromMerchant(eats, '')).toEqual(start);
  });

  it('leaves a category that was not guessed alone', () => {
    const picked: GuessState = { category: 'health', necessity: 'need', guessedFrom: null, beforeGuess: null };
    expect(guessFromMerchant(picked, 'Bob')).toEqual(picked);
  });
});
