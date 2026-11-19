// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { DroppedSaveError, createPendingSaves } from '../../src/web/lib/pending-saves.js';

/** A promise the test settles by hand. */
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Saves started while leaving a section are tracked', () => {
  test('settles only after every tracked save has finished', async () => {
    const saves = createPendingSaves();
    const first = deferred();
    const second = deferred();
    saves.track('store-texts', first.promise);
    saves.track('logo', second.promise);
    let done = false;
    const settled = saves.settled().then(() => {
      done = true;
    });
    first.resolve();
    await Promise.resolve();
    expect(done).toBe(false);
    second.resolve();
    await settled;
    expect(done).toBe(true);
    // Nothing left to wait for.
    await expect(saves.settled()).resolves.toBeUndefined();
  });

  test('reports a failed and a dropped save with section and reason, and still settles', async () => {
    const saves = createPendingSaves();
    const lost: string[] = [];
    const unsubscribe = saves.subscribe((section, reason) => lost.push(`${section}: ${reason}`));
    const save = deferred();
    saves.track('screenshots', save.promise);
    saves.track('store-texts', Promise.reject(new DroppedSaveError()));
    save.reject(new Error('offline'));
    await expect(saves.settled()).resolves.toBeUndefined();
    expect(lost.sort()).toEqual(['screenshots: failed', 'store-texts: dropped']);

    saves.reportSaved('screenshots');
    expect(lost).toContain('screenshots: saved');

    unsubscribe();
    saves.track('logo', Promise.reject(new Error('offline')));
    await saves.settled();
    expect(lost).toHaveLength(3);
  });

  test('stops waiting for a save that never answers after the maximum wait', async () => {
    const saves = createPendingSaves();
    saves.track('logo', new Promise(() => undefined));
    const started = Date.now();
    await expect(saves.settled(50)).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
