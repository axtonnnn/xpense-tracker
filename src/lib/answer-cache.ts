// AI answers kept for this app session, so coming back to a screen doesn't ask (and pay) again.
//
// The app stays running through a sign-out, and this memory with it, so answers are kept per account:
// each account has its own database, and the next person must not be shown the last one's money.
export function answerCache<T>() {
  const answers = new Map<string, T>();
  const full = (account: string | undefined, key: string) => `${account ?? ''}|${key}`;
  return {
    get: (account: string | undefined, key: string): T | undefined => answers.get(full(account, key)),
    set: (account: string | undefined, key: string, answer: T): void => {
      answers.set(full(account, key), answer);
    },
  };
}
