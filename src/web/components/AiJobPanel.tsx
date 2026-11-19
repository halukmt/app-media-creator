import { useId, useRef, useState, type RefObject } from 'react';
import type { AiJob } from '../api';
import { en } from '../i18n/en';
import { headlineLocales } from '../lib/ai-jobs';
import { BusyButton } from './BusyButton';
import { CommandBox } from './CommandBox';
import { ConfirmDialog } from './ConfirmDialog';
import { HeadlineVariantsCard } from './HeadlineVariantsCard';
import { ProgressStatus } from './ProgressStatus';
import { StatusAlert } from './StatusAlert';

type Variant = 'A' | 'B';

/** Outcome of the last action; prepare messages show at the top, apply messages next to the apply buttons. */
export interface AiJobMessage {
  action: 'prepare' | 'apply';
  tone: 'success' | 'error';
  text: string;
  details?: string[];
}

interface Props {
  /** The newest copy job, or null before the first one. */
  job: AiJob | null;
  /** Project locales, for the order of the languages. */
  order: readonly string[];
  localeName: (locale: string) => string;
  /** Title of a slot in the comparison, e.g. "Screenshot 1 · start". */
  slotTitle: (locale: string, input: string, index: number) => string;
  preparing: boolean;
  /** The variant being applied, or null. */
  applying: Variant | null;
  message: AiJobMessage | null;
  onPrepare: () => void;
  onApply: (variant: Variant) => void;
}

function ErrorAlert({ message }: { message: AiJobMessage }) {
  return (
    <StatusAlert announce={false} tone="error" title={message.text}>
      {message.details && message.details.length > 0 ? <p className="wrap-anywhere">{message.details.join(' ')}</p> : null}
    </StatusAlert>
  );
}

/**
 * AI headlines for the screenshot sets: prepares a job folder, shows the command to run in Claude Code, follows the
 * job live, compares variant A and B per language, and applies one variant after a confirmation.
 */
export function AiJobPanel({ job, order, localeName, slotTitle, preparing, applying, message, onPrepare, onApply }: Props) {
  const headingId = useId();
  const [confirm, setConfirm] = useState<Variant | null>(null);
  // The variant whose button opened the dialog last; kept after closing, so focus returns to that button.
  const [opener, setOpener] = useState<Variant>('A');
  // Focus goes back to the button that opened the dialog.
  const buttons: Record<Variant, RefObject<HTMLButtonElement | null>> = { A: useRef<HTMLButtonElement>(null), B: useRef<HTMLButtonElement>(null) };
  const t = en.screenshots.ai;
  const locales = job ? headlineLocales(job, order) : [];
  const languages = locales.map(localeName).join(', ');
  const missing = job && (job.status === 'ready' || job.status === 'applied') ? job.locales.filter((locale) => !locales.includes(locale)) : [];
  const canApply = job !== null && (job.status === 'ready' || job.status === 'applied') && locales.length > 0;
  const applyMessage = message?.action === 'apply' ? message : null;
  const prepareMessage = message?.action === 'prepare' ? message : null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-lg font-semibold">
        {t.heading}
      </h3>
      <p className="max-w-prose text-sm text-base-content/70">{t.intro}</p>
      <div>
        <BusyButton busy={preparing} busyLabel={t.preparing} onClick={onPrepare}>
          {t.prepare}
        </BusyButton>
      </div>
      <div role="alert">{prepareMessage?.tone === 'error' ? <ErrorAlert message={prepareMessage} /> : null}</div>

      {job ? (
        <>
          <p className="text-sm text-base-content/70">{t.forLocales(job.locales.map(localeName).join(', '))}</p>
          <CommandBox label={t.commandLabel} command={job.command} />
        </>
      ) : null}

      <div role="status">
        {job?.status === 'waiting' ? <ProgressStatus label={t.waiting} /> : null}
        {/* One success line: the applied state of the job, or "ready". */}
        {job && canApply ? <StatusAlert announce={false} tone="success" title={job.applied ? t.applied(job.applied.variant, languages) : t.ready} /> : null}
      </div>
      <div role="alert">
        {job?.status === 'invalid' ? (
          <StatusAlert announce={false} tone="error" title={t.invalid}>
            <ul className="list-disc pl-5 wrap-anywhere">
              {job.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </StatusAlert>
        ) : null}
      </div>
      {missing.length > 0 ? <StatusAlert tone="info" title={t.missingLocales(missing.map(localeName).join(', '))} /> : null}
      {job && job.warnings.length > 0 ? (
        <StatusAlert tone="warning" title={t.warningsTitle} announce={false}>
          <ul className="list-disc pl-5 wrap-anywhere">
            {job.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </StatusAlert>
      ) : null}

      {canApply && job?.headlines ? (
        <>
          <p className="text-sm text-base-content/70">{t.variantHint}</p>
          <div className="grid grid-cols-1 gap-3">
            {locales.map((locale) => (
              <HeadlineVariantsCard
                key={locale}
                locale={locale}
                localeName={localeName(locale)}
                slots={(job.headlines?.locales[locale]?.slots ?? []).map((slot, index) => ({ title: slotTitle(locale, slot.input, index), A: slot.A, B: slot.B }))}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {(['A', 'B'] as const).map((variant) => (
              <BusyButton key={variant} ref={buttons[variant]} busy={applying === variant} busyLabel={t.applying} disabled={applying !== null}
                onClick={() => {
                  setOpener(variant);
                  setConfirm(variant);
                }}
              >
                {t.apply(variant)}
              </BusyButton>
            ))}
          </div>
          {/* Errors of the apply step right below its buttons (L5). */}
          <div role="alert">{applyMessage?.tone === 'error' ? <ErrorAlert message={applyMessage} /> : null}</div>
        </>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        title={t.confirmTitle(confirm ?? 'A')}
        confirmLabel={t.apply(confirm ?? 'A')}
        cancelLabel={en.common.cancel}
        onConfirm={() => {
          const variant = confirm;
          setConfirm(null);
          if (variant) onApply(variant);
        }}
        onCancel={() => setConfirm(null)}
        returnFocus={buttons[opener]}
      >
        <p>{t.confirmBody(languages)}</p>
      </ConfirmDialog>
    </section>
  );
}
