// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { DroppedSaveError, createPendingSaves, lostSections, withOutcome, type LostEdit } from '../../src/web/lib/pending-saves.js';

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

const STORE_TEXTS = { section: 'store-texts', document: 'store-texts' } as const;
const SETS = { section: 'screenshots', document: 'screenshots' } as const;
const CREATIVE = { section: 'screenshots', document: 'creative-settings' } as const;
const LOGO = { section: 'logo', document: 'logo-settings' } as const;

describe('Saves started while leaving a section are tracked', () => {
  test('settles only after every tracked save has finished', async () => {
    const saves = createPendingSaves();
    const first = deferred();
    const second = deferred();
    saves.track(STORE_TEXTS, first.promise);
    saves.track(LOGO, second.promise);
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

  test('reports a failed and a dropped save with document and outcome, and still settles', async () => {
    const saves = createPendingSaves();
    const outcomes: string[] = [];
    const unsubscribe = saves.subscribe((source, outcome) => outcomes.push(`${source.document}: ${outcome}`));
    const save = deferred();
    saves.track(SETS, save.promise);
    saves.track(STORE_TEXTS, Promise.reject(new DroppedSaveError()));
    save.reject(new Error('offline'));
    await expect(saves.settled()).resolves.toBeUndefined();
    expect(outcomes.sort()).toEqual(['screenshots: failed', 'store-texts: dropped']);

    saves.reportSaved(CREATIVE);
    expect(outcomes).toContain('creative-settings: saved');

    unsubscribe();
    saves.track(LOGO, Promise.reject(new Error('offline')));
    await saves.settled();
    expect(outcomes).toHaveLength(3);
  });

  test('stops waiting for a save that never answers after the maximum wait', async () => {
    const saves = createPendingSaves();
    saves.track(LOGO, new Promise(() => undefined));
    const started = Date.now();
    await expect(saves.settled(50)).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('Lost edits are kept per document and shown once per section', () => {
  test('keeps the failed screenshot sets when the header settings of the same section saved (#103)', () => {
    let lost: LostEdit[] = [];
    lost = withOutcome(lost, SETS, 'failed');
    lost = withOutcome(lost, CREATIVE, 'saved');
    expect(lostSections(lost)).toEqual([{ section: 'screenshots', reason: 'failed' }]);
    // A later save of the lost document itself clears it; a save with nothing to clear keeps the same list.
    lost = withOutcome(lost, SETS, 'saved');
    expect(lostSections(lost)).toEqual([]);
    expect(withOutcome(lost, STORE_TEXTS, 'saved')).toBe(lost);
  });

  test('shows one message per section, with the failure winning over a conflict', () => {
    let lost: LostEdit[] = [];
    lost = withOutcome(lost, CREATIVE, 'dropped');
    lost = withOutcome(lost, STORE_TEXTS, 'dropped');
    lost = withOutcome(lost, SETS, 'failed');
    expect(lostSections(lost)).toEqual([
      { section: 'screenshots', reason: 'failed' },
      { section: 'store-texts', reason: 'dropped' },
    ]);
  });
});
