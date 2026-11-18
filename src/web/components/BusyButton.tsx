import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

interface Props {
  busy: boolean;
  /** Label while busy, e.g. "Saving…". */
  busyLabel: string;
  children: ReactNode;
  type?: 'button' | 'submit';
  /** Ignored while busy. */
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  primary?: boolean;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Button for an operation that takes a moment. While busy it shows a spinner and the busy label, and stays focusable
 * (`aria-disabled` instead of `disabled`), so keyboard focus is not lost; clicks are ignored.
 */
export function BusyButton({ busy, busyLabel, children, type = 'button', onClick, primary = false, disabled = false, ref }: Props) {
  const inactive = busy || disabled;
  return (
    <button
      ref={ref}
      type={type}
      className={`btn min-h-11 ${primary ? 'btn-primary' : ''}`}
      aria-disabled={inactive}
      onClick={(event) => {
        if (inactive) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {busy ? <span className="loading loading-spinner" aria-hidden="true" /> : null}
      {busy ? busyLabel : children}
    </button>
  );
}
