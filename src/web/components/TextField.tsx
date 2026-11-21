import { useId } from 'react';
import { en } from '../i18n/en';
import { FieldError } from './FieldError';
import { RequiredBadge } from './RequiredBadge';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  /** Renders a textarea (one entry per line) instead of a single-line input. */
  multiline?: boolean;
  rows?: number;
  /** Marks the field as required (attribute and a "Required" marker next to the label). */
  required?: boolean;
  maxLength?: number;
  /** Language of the text (spell-check and pronunciation), e.g. tr-TR for a Turkish headline. */
  lang?: string;
  /** Live length against a limit, e.g. "31 / 30 characters"; `over` marks the field as invalid. */
  counter?: { text: string; over: boolean };
  /** Check messages for the current text; errors mark the field as invalid. */
  messages?: readonly { level: 'error' | 'warning'; text: string }[];
  /** Read-only while an operation runs; stays focusable (`aria-disabled`). */
  disabled?: boolean;
  /** Keyboard on touch devices, e.g. `decimal` for seconds; the input stays `type="text"` (no scroll-wheel changes). */
  inputMode?: 'decimal' | 'numeric' | 'text' | 'url';
}

/** A labelled text input or textarea with hint, counter, error and check messages, wired for screen readers. */
export function TextField({ label, value, onChange, hint, error, multiline = false, rows = 4, required, maxLength, lang, counter, messages = [], disabled = false, inputMode }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const counterId = `${id}-counter`;
  const errorId = `${id}-error`;
  const messageId = (index: number) => `${id}-message-${index}`;
  const invalid = Boolean(error) || Boolean(counter?.over) || messages.some((message) => message.level === 'error');
  const describedBy =
    [hint ? hintId : null, counter ? counterId : null, error ? errorId : null, ...messages.map((_, index) => messageId(index))].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    value,
    required,
    maxLength,
    lang,
    readOnly: disabled || undefined,
    'aria-disabled': disabled || undefined,
    'aria-invalid': invalid || undefined,
    'aria-describedby': describedBy,
    ...(inputMode && !multiline ? { inputMode } : {}),
  };

  return (
    // A div, not a fieldset: inside a store's fieldset an unnamed nested group would be announced for every field.
    <div className="fieldset">
      {/* The marker sits outside the label, so the field's accessible name stays the label text. */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="fieldset-legend">
          {label}
        </label>
        {required ? <RequiredBadge /> : null}
      </div>
      {multiline ? (
        <textarea
          {...common}
          rows={rows}
          className={`textarea w-full field-sizing-content max-h-[60vh] aria-disabled:cursor-not-allowed aria-disabled:bg-base-200 ${invalid ? 'textarea-error' : ''}`}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          {...common}
          type="text"
          className={`input w-full min-h-11 aria-disabled:cursor-not-allowed aria-disabled:bg-base-200 ${invalid ? 'input-error' : ''}`}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint ? (
        <p id={hintId} className="label whitespace-normal">
          {hint}
        </p>
      ) : null}
      {counter ? (
        <p id={counterId} className={`label whitespace-normal ${counter.over ? 'font-semibold text-base-content' : ''}`}>
          {counter.text}
        </p>
      ) : null}
      {/* Announced only when the field goes over or back under its limit, not on every keystroke. */}
      {counter ? (
        <span className="sr-only" aria-live="polite">
          {counter.over ? en.common.overLimit : ''}
        </span>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      {messages.map((message, index) => (
        <FieldError key={index} id={messageId(index)} tone={message.level}>
          {`${en.status[message.level]}: ${message.text}`}
        </FieldError>
      ))}
    </div>
  );
}
