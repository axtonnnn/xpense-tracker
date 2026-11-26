import { describe, expect, it } from '@jest/globals';

import { oneAtATime } from '../once';

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('oneAtATime', () => {
  it('skips a second tap while the first save is still running', async () => {
    const guard = oneAtATime();
    const gate = deferred();
    let saves = 0;
    const save = () =>
      guard.run(async () => {
        saves++;
        await gate.promise;
        return 'saved';
      });
    const first = save();
    const second = save();
    expect(guard.running).toBe(true);
    gate.resolve();
    await expect(first).resolves.toBe('saved');
    await expect(second).resolves.toBeUndefined();
    expect(saves).toBe(1);
    expect(guard.running).toBe(false);
  });

  it('runs again once the first one has finished', async () => {
    const guard = oneAtATime();
    let saves = 0;
    await guard.run(async () => saves++);
    await guard.run(async () => saves++);
    expect(saves).toBe(2);
  });

  it('lets the next tap through after a failed save', async () => {
    const guard = oneAtATime();
    await expect(
      guard.run(async () => {
        throw new Error('disk full');
      }),
    ).rejects.toThrow('disk full');
    expect(guard.running).toBe(false);
    await expect(guard.run(async () => 'ok')).resolves.toBe('ok');
  });
});
