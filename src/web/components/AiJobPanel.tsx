import { useId, useRef, useState, type ReactNode } from 'react';
import type { AiJob } from '../api';
import { en } from '../i18n/en';
import { BusyButton } from './BusyButton';
import { CommandBox } from './CommandBox';
import { ConfirmDialog } from './ConfirmDialog';
import { ProgressStatus } from './ProgressStatus';
import { StatusAlert } from './StatusAlert';

/** Outcome of the last action; prepare messages show at the top, apply messages next to the apply buttons. */
export interface AiJobMessage {
  action: 'prepare' | 'apply';
  tone: 'success' | 'error';
  text: string;
  details?: string[];
}

/** The texts of one section's job panel (headlines or store texts). */
export interface AiJobText {
  heading: string;
  intro: string;
  prepare: string;
  preparing: string;
  commandLabel: string;
  waiting: string;
  ready: string;
  invalid: string;
  warningsTitle: string;
  applying: string;
  forLocales: (languages: string) => string;
  missingLocales: (languages: string) => string;
  /** Success line of an applied job; `variant` for headline jobs. */
  applied: (languages: string, variant?: string) => string;
}

/** One way to apply the result, e.g. "Apply variant A", each behind its own confirmation. */
export interface AiJobAction {
  id: string;
  label: string;
  confirmTitle: string;
  confirmBody: string;
}

interface Props {
  /** The newest job of this section's task, or null before the first one. */
  job: AiJob | null;
  text: AiJobText;
  /** Languages the result has texts for, in project order. */
  resultLocales: readonly string[];
  localeName: (locale: string) => string;
  actions: readonly AiJobAction[];
  preparing: boolean;
  /** Preparing is not possible yet (e.g. no language selected). */
  prepareDisabled?: boolean;
  /** The id of the action being applied, or null. */
  applying: string | null;
  message: AiJobMessage | null;
  onPrepare: () => void;
  onApply: (actionId: string) => void;
  /** Read-only preview of the result, shown when it can be applied. */
  children?: ReactNode;
}

function ErrorAlert({ message }: { message: AiJobMessage }) {
  return (
    <StatusAlert announce={false} tone="error" title={message.text}>
      {message.details && message.details.length > 0 ? <p className="wrap-anywhere">{message.details.join(' ')}</p> : null}
    </StatusAlert>
  );
}

/**
 * An AI job of one section: prepares a job folder, shows the command to run in Claude Code, follows the job live,
 * shows the result preview (children), and applies it through one of the actions after a confirmation.
 */
export function AiJobPanel({ job, text: t, resultLocales, localeName, actions, preparing, prepareDisabled = false, applying, message, onPrepare, onApply, children }: Props) {
  const headingId = useId();
  const [confirm, setConfirm] = useState<AiJobAction | null>(null);
  // The action whose dialog opened last; kept after closing, so the dialog keeps its texts while it closes.
  const [shown, setShown] = useState<AiJobAction | null>(null);
  // Focus goes back to the button that opened the dialog; the ref is set when the dialog opens.
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const languages = resultLocales.map(localeName).join(', ');
  const usable = job !== null && (job.status === 'ready' || job.status === 'applied');
  const missing = usable ? job.locales.filter((locale) => !resultLocales.includes(locale)) : [];
  const canApply = usable && resultLocales.length > 0;
  const applyMessage = message?.action === 'apply' ? message : null;
  const prepareMessage = message?.action === 'prepare' ? message : null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-lg font-semibold">
        {t.heading}
      </h3>
      <p className="max-w-prose text-sm text-base-content/70">{t.intro}</p>
      <div>
        <BusyButton busy={preparing} busyLabel={t.preparing} disabled={prepareDisabled} onClick={onPrepare}>
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
        {job && canApply ? <StatusAlert announce={false} tone="success" title={job.applied ? t.applied(languages, job.applied.variant) : t.ready} /> : null}
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

      {canApply ? (
        <>
          {children}
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <BusyButton
                key={action.id}
                ref={(element: HTMLButtonElement | null) => {
                  if (element) buttons.current.set(action.id, element);
                  else buttons.current.delete(action.id);
                }}
                busy={applying === action.id}
                busyLabel={t.applying}
                disabled={applying !== null}
                onClick={() => {
                  returnFocus.current = buttons.current.get(action.id) ?? null;
                  setShown(action);
                  setConfirm(action);
                }}
              >
                {action.label}
              </BusyButton>
            ))}
          </div>
          {/* Errors of the apply step right below its buttons (L5). */}
          <div role="alert">{applyMessage?.tone === 'error' ? <ErrorAlert message={applyMessage} /> : null}</div>
        </>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        title={shown?.confirmTitle ?? ''}
        confirmLabel={shown?.label ?? ''}
        cancelLabel={en.common.cancel}
        onConfirm={() => {
          const action = confirm;
          setConfirm(null);
          if (action) onApply(action.id);
        }}
        onCancel={() => setConfirm(null)}
        returnFocus={returnFocus}
      >
        <p>{shown?.confirmBody ?? ''}</p>
      </ConfirmDialog>
    </section>
  );
}
