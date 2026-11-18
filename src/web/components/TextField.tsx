import { useId } from 'react';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  /** Renders a textarea (one entry per line) instead of a single-line input. */
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  maxLength?: number;
}

/** A labelled text input or textarea with hint and error, wired for screen readers. */
export function TextField({ label, value, onChange, hint, error, multiline = false, rows = 4, required, maxLength }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    value,
    required,
    maxLength,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  };

  return (
    <fieldset className="fieldset">
      <label htmlFor={id} className="fieldset-legend">
        {label}
      </label>
      {multiline ? (
        <textarea
          {...common}
          rows={rows}
          className={`textarea w-full ${error ? 'textarea-error' : ''}`}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          {...common}
          type="text"
          className={`input w-full min-h-11 ${error ? 'input-error' : ''}`}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint ? (
        <p id={hintId} className="label whitespace-normal">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="border-l-4 border-error pl-2 text-sm font-medium">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
