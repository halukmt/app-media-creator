import type { ReactNode } from 'react';

type Tone = 'info' | 'success' | 'warning' | 'error';

interface Props {
  tone: Tone;
  title?: string;
  children?: ReactNode;
}

const TONE_CLASS: Record<Tone, string> = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
};

/**
 * Feedback line (L5). Errors and warnings use `role="alert"`, everything else `role="status"`.
 * Callers that announce changing messages keep this mounted inside a live region.
 */
export function StatusAlert({ tone, title, children }: Props) {
  const urgent = tone === 'error' || tone === 'warning';
  return (
    <div role={urgent ? 'alert' : 'status'} className={`alert alert-vertical sm:alert-horizontal ${TONE_CLASS[tone]}`}>
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-sm">{children}</div> : null}
      </div>
    </div>
  );
}
