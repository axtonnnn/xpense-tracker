/**
 * Runs one async action at a time: a call made while an earlier one is still running is skipped
 * (resolves to `undefined`) instead of running again. A quick double tap on "Save changes" then saves
 * once and leaves the screen once. Once the running action finishes, or fails, the next call runs.
 *
 * Keep one guard per screen (e.g. `useRef(oneAtATime()).current`); each call can pass a fresh closure,
 * so it always sees the latest form values.
 */
export function oneAtATime() {
  let running = false;
  return {
    get running() {
      return running;
    },
    async run<R>(action: () => Promise<R>): Promise<R | undefined> {
      if (running) return undefined;
      running = true;
      try {
        return await action();
      } finally {
        running = false;
      }
    },
  };
}
