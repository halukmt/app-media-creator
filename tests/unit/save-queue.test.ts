// conventions: RULE-TESTING-3301
import { describe, expect, test, vi } from 'vitest';
import { SaveDiscardedError, createSaveQueue } from '../../src/web/lib/save-queue.js';

describe('The save queue stores the latest edits one save at a time', () => {
  test('saves only the newest scheduled version and reports success', async () => {
    const save = vi.fn(async (_doc: string) => undefined);
    const saved = vi.fn();
    const queue = createSaveQueue(save, saved);
    queue.schedule('first');
    queue.schedule('second');
    await queue.flush();
    expect(save.mock.calls).toEqual([['second']]);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(queue.hasPending()).toBe(false);
  });

  test('drops a pending version on discard, so a conflicting edit is never sent again (#85)', async () => {
    const save = vi.fn(async (_doc: string) => {
      throw new Error('conflict');
    });
    const queue = createSaveQueue(save);
    queue.schedule('stale');
    await expect(queue.flush()).rejects.toThrow('conflict');
    expect(queue.hasPending()).toBe(true);
    queue.discard();
    expect(queue.hasPending()).toBe(false);
    await queue.flush().catch(() => undefined);
    expect(save).toHaveBeenCalledTimes(1);
  });

  test('never sends saves that were already queued behind a conflicting one when it is discarded (#92)', async () => {
    let rejectFirst!: (error: Error) => void;
    const save = vi.fn((doc: string) => (doc === 'first' ? new Promise<void>((_resolve, reject) => (rejectFirst = reject)) : Promise.resolve()));
    const queue = createSaveQueue(save, undefined, { discardOn: (error) => (error as Error).message === '409' });
    queue.schedule('first');
    const first = queue.flush();
    // Two more edits are flushed while the first save is still running: they wait in the queue.
    queue.schedule('second');
    const second = queue.flush();
    queue.schedule('third');
    const third = queue.flush();
    await Promise.resolve();
    expect(save.mock.calls).toEqual([['first']]);
    // The first save is refused as a conflict: everything based on the old version is dropped at once.
    rejectFirst(new Error('409'));
    await expect(first).rejects.toThrow('409');
    // The queued flushes say that their versions were dropped instead of resolving as saved.
    await expect(second).rejects.toBeInstanceOf(SaveDiscardedError);
    await expect(third).rejects.toBeInstanceOf(SaveDiscardedError);
    expect(save.mock.calls).toEqual([['first']]);
    expect(queue.hasPending()).toBe(false);
    // Nothing new: a later flush resolves instead of repeating the conflict.
    await expect(queue.flush()).resolves.toBeUndefined();
  });

  test('drops a flush queued behind a running save on a manual discard and reports it (#92)', async () => {
    let finishFirst!: () => void;
    const save = vi.fn((doc: string) => (doc === 'A' ? new Promise<void>((resolve) => (finishFirst = resolve)) : Promise.resolve()));
    const queue = createSaveQueue(save);
    queue.schedule('A');
    const a = queue.flush();
    // A has started; B waits behind it.
    await Promise.resolve();
    expect(save.mock.calls).toEqual([['A']]);
    queue.schedule('B');
    const b = queue.flush();
    expect(queue.discard()).toBe(true);
    finishFirst();
    await a;
    await expect(b).rejects.toBeInstanceOf(SaveDiscardedError);
    expect(save.mock.calls).toEqual([['A']]);
    expect(queue.discard()).toBe(false);
  });

  test('rejects a failed flush and keeps the edits for the next attempt', async () => {
    let fail = true;
    const save = vi.fn(async (_doc: string) => {
      if (fail) throw new Error('offline');
    });
    const queue = createSaveQueue(save);
    queue.schedule('edit');
    await expect(queue.flush()).rejects.toThrow('offline');
    expect(queue.hasPending()).toBe(true);
    fail = false;
    await queue.flush();
    expect(save.mock.calls.at(-1)).toEqual(['edit']);
    expect(queue.hasPending()).toBe(false);
  });

  test('keeps a newer edit made while a failing save was running', async () => {
    let release: () => void = () => undefined;
    const save = vi.fn(
      (doc: string) =>
        new Promise<void>((_resolve, reject) => {
          release = () => reject(new Error(`failed ${doc}`));
        }),
    );
    const queue = createSaveQueue(save);
    queue.schedule('old');
    const running = queue.flush();
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    queue.schedule('newer');
    release();
    await expect(running).rejects.toThrow('failed old');
    save.mockImplementation(async () => undefined);
    await queue.flush();
    expect(save.mock.calls.at(-1)).toEqual(['newer']);
  });

  test('fails a flush with nothing new when the save already running fails', async () => {
    let release: () => void = () => undefined;
    const save = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          release = () => reject(new Error('offline'));
        }),
    );
    const queue = createSaveQueue(save);
    queue.schedule('edit');
    void queue.flush().catch(() => undefined); // the debounce timer
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    const beforeGenerate = queue.flush(); // the Generate button, nothing new to send
    release();
    await expect(beforeGenerate).rejects.toThrow('offline');
    expect(queue.hasPending()).toBe(true);
  });

  test('resolves at once when nothing is pending', async () => {
    const save = vi.fn(async () => undefined);
    await createSaveQueue(save).flush();
    expect(save).not.toHaveBeenCalled();
  });
});

describe('A failed save never comes back over newer edits', () => {
  test('old fails while new is queued: new is saved and old is not written again', async () => {
    let failOld: () => void = () => undefined;
    const save = vi.fn((doc: string) =>
      doc === 'old'
        ? new Promise<void>((_resolve, reject) => {
            failOld = () => reject(new Error('offline'));
          })
        : Promise.resolve(),
    );
    const queue = createSaveQueue(save);
    queue.schedule('old');
    const oldRun = queue.flush().catch(() => undefined);
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith('old'));
    queue.schedule('new');
    const newRun = queue.flush();
    failOld();
    await oldRun;
    await newRun;
    expect(queue.hasPending()).toBe(false);
    await queue.flush();
    expect(save.mock.calls.map(([doc]) => doc)).toEqual(['old', 'new']);
  });
});
