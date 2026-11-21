import { useState } from 'react';
import { applyJob, createJob, messagesOf, type AiJob, type PromoJobOptions } from '../api';
import { useAiJob } from './useAiJob';

/** What the last action of the promo job panel did; the page turns it into text (hooks have no UI strings). */
export interface PromoJobOutcome {
  action: 'prepare' | 'apply';
  result: 'saveFirst' | 'failed';
  details?: string[];
}

/**
 * The promo reel job of the Video section (#22): the newest `promo-video` job, preparing a new one (after pending
 * settings are saved) and adding its checked reels to the outputs.
 */
export function usePromoJob(onApplied: () => Promise<void> | void): {
  job: AiJob | null;
  busy: 'prepare' | 'apply' | null;
  outcome: PromoJobOutcome | null;
  prepare: (locales: readonly string[], options: PromoJobOptions, flush: () => Promise<void>) => Promise<void>;
  apply: () => Promise<void>;
} {
  const { job, showJob, refreshJob } = useAiJob('promo-video');
  const [busy, setBusy] = useState<'prepare' | 'apply' | null>(null);
  const [outcome, setOutcome] = useState<PromoJobOutcome | null>(null);

  async function prepare(locales: readonly string[], options: PromoJobOptions, flush: () => Promise<void>) {
    setOutcome(null);
    // The job must carry what the page shows: send pending settings first.
    try {
      await flush();
    } catch {
      setOutcome({ action: 'prepare', result: 'saveFirst' });
      return;
    }
    setBusy('prepare');
    try {
      showJob(await createJob('promo-video', locales, options));
    } catch (error) {
      setOutcome({ action: 'prepare', result: 'failed', details: messagesOf(error) });
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!job) return;
    setOutcome(null);
    setBusy('apply');
    try {
      await applyJob(job.id);
      showJob({ ...job, status: 'applied', applied: { at: new Date().toISOString() } });
      await onApplied();
    } catch (error) {
      setOutcome({ action: 'apply', result: 'failed', details: messagesOf(error) });
    } finally {
      refreshJob(job.id);
      setBusy(null);
    }
  }

  return { job, busy, outcome, prepare, apply };
}
