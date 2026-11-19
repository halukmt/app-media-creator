import { useId, useRef } from 'react';
import { FieldError } from './FieldError';

interface Props {
  label: string;
  /** MIME types or extensions the picker offers, e.g. "image/png,image/jpeg,image/webp". */
  accept: string;
  multiple?: boolean;
  /** Called with the picked files; the field is cleared afterwards so the same file can be picked again. */
  onFiles: (files: File[]) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
}

/** A labelled file picker with hint and error, the upload counterpart of TextField. */
export function FileField({ label, accept, multiple = false, onFiles, hint, error, disabled }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <fieldset className="fieldset">
      <label htmlFor={id} className="fieldset-legend">
        {label}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        className={`file-input min-h-11 w-full max-w-md ${error ? 'file-input-error' : ''}`}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (files.length > 0) onFiles(files);
          if (input.current) input.current.value = '';
        }}
      />
      {hint ? (
        <p id={`${id}-hint`} className="label whitespace-normal">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </fieldset>
  );
}
