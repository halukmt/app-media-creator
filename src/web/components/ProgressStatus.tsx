interface Props {
  /** Status line, e.g. "Uploading 2 of 5…". */
  label: string;
  /** Work done and total when known; without them a spinner is shown. */
  value?: number;
  max?: number;
}

/**
 * L5 progress of a longer operation: a progress bar when the total is known, otherwise a spinner, always with a text
 * line. Place it inside a mounted live region (`role="status"`) so the text is announced.
 */
export function ProgressStatus({ label, value, max }: Props) {
  const known = value !== undefined && max !== undefined && max > 0;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-3">
        {known ? null : <span className="loading loading-spinner" aria-hidden="true" />}
        {label}
      </p>
      {known ? <progress className="progress w-full max-w-md" value={value} max={max} aria-hidden="true" /> : null}
    </div>
  );
}
