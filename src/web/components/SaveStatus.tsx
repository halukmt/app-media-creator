import { en } from '../i18n/en';
import { StatusAlert } from './StatusAlert';

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'conflict';

interface Props {
  state: SaveState;
  failedText: string;
  /** Shown when a save was refused because the data changed elsewhere; omit where that cannot happen. */
  conflictText?: string;
}

/**
 * Autosave feedback: a quiet status line ("Saving…", "Changes saved.") that screen readers do not announce on every
 * keystroke, and an alert next to it when a save failed or was refused.
 */
export function SaveStatus({ state, failedText, conflictText }: Props) {
  return (
    <>
      <p className="text-sm text-base-content/70" aria-live="off">
        {state === 'saving' ? en.common.saving : state === 'saved' ? en.common.saved : ''}
      </p>
      <div role="alert">
        {state === 'failed' ? <StatusAlert announce={false} tone="error" title={failedText} /> : null}
        {state === 'conflict' && conflictText ? <StatusAlert announce={false} tone="warning" title={conflictText} /> : null}
      </div>
    </>
  );
}
