// The entry screen's category guess as the shop name is typed. Kept pure so it can be unit-tested.
import type { Necessity } from '../../shared/schemas';
import { categorize } from './categorize';

export type Picked = { category: string; necessity: Necessity };

export type GuessState = Picked & {
  /** The word the guess came from ("bar"), or null when nothing was guessed. */
  guessedFrom: string | null;
  /** What was picked before the guess changed it, so it can be put back when the guess no longer fits. */
  beforeGuess: Picked | null;
};

/**
 * Updates the guess for the shop name as typed so far. The name is guessed letter by letter, so "Bar"
 * guesses Dining on the way to "Barnes & Noble", and "Spa" Personal care on the way to "Spar". When the
 * finished name no longer matches, the earlier category comes back instead of the stale guess staying.
 */
export function guessFromMerchant(state: GuessState, text: string): GuessState {
  const guess = categorize(text);
  if (guess) {
    return {
      category: guess.category,
      necessity: guess.necessity,
      guessedFrom: guess.matched,
      beforeGuess: state.beforeGuess ?? { category: state.category, necessity: state.necessity },
    };
  }
  if (state.beforeGuess) return { ...state.beforeGuess, guessedFrom: null, beforeGuess: null };
  return { ...state, guessedFrom: null };
}
