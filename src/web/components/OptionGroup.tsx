import { useId, type ReactNode } from 'react';
import { FieldError } from './FieldError';
import { RequiredBadge } from './RequiredBadge';

export interface Option {
  id: string;
  label: string;
  /** Second line under the label (card variant). */
  description?: string;
  /** Small picture next to the label (swatch, layout sketch); decorative, the label carries the meaning. */
  visual?: ReactNode;
  disabled?: boolean;
  /** Short marker shown as a badge, e.g. "Comes later". */
  note?: string;
  /** Language of a label in another language (native locale names). */
  lang?: string;
  /** A short text shown after the label in a lighter weight (e.g. the native name). */
  secondary?: string;
  /** Put this option on its own row before the others (e.g. "All languages"). */
  separate?: boolean;
}

interface Props {
  label: string;
  options: readonly Option[];
  /** Ids of the selected options. */
  value: readonly string[];
  /** Called with the chosen option id; the caller decides the new selection. */
  onSelect: (id: string) => void;
  /** Checkboxes instead of radio buttons. */
  multiple?: boolean;
  /** `chip`: compact buttons that wrap; `card`: larger blocks with a description. */
  variant?: 'chip' | 'card';
  /** Text after the legend, e.g. "3 of 6 languages". */
  legendExtra?: string;
  hint?: string;
  error?: string;
}

// Unselected: light outline. Selected: active fill, strong border and a check mark, so the state does not rely on
// colour alone. The focus ring uses the text colour of the theme, visible on both states.
const CHIP =
  'group btn btn-outline min-h-11 h-auto py-2 border-base-300 font-medium ' +
  'has-[:checked]:btn-active has-[:checked]:border-base-content ' +
  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-base-content ' +
  'has-[:disabled]:opacity-60 has-[:disabled]:cursor-not-allowed';

const CARD =
  'group card card-border min-h-11 cursor-pointer bg-base-100 p-4 text-left ' +
  'has-[:checked]:border-base-content has-[:checked]:bg-base-200 ' +
  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-base-content ' +
  'has-[:disabled]:opacity-60 has-[:disabled]:cursor-not-allowed';

function CheckMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="hidden size-4 shrink-0 group-has-[:checked]:block" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Pick one (radio) or several (checkbox) of a few options, shown as buttons or cards. Each option is a native input
 * inside a styled label, so keyboard and screen readers get standard controls; options wrap on narrow screens.
 */
export function OptionGroup({ label, options, value, onSelect, multiple = false, variant = 'chip', legendExtra, hint, error }: Props) {
  const name = useId();
  const describedBy = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(' ') || undefined;

  function optionLabel(option: Option) {
    return (
      <label key={option.id} className={variant === 'card' ? CARD : `${CHIP} ${option.separate ? 'btn-sm' : ''}`}>
        <input
          type={multiple ? 'checkbox' : 'radio'}
          name={multiple ? undefined : name}
          className="sr-only"
          value={option.id}
          checked={value.includes(option.id)}
          disabled={option.disabled}
          onChange={() => onSelect(option.id)}
        />
        <span className="flex flex-wrap items-center gap-2">
          <CheckMark />
          {option.visual}
          <span className={variant === 'card' ? 'font-semibold' : ''} lang={option.lang}>
            {option.label}
          </span>
          {option.secondary ? (
            <span className="text-xs font-normal opacity-80" lang={option.lang}>
              {option.secondary}
            </span>
          ) : null}
          {option.note ? <RequiredBadge label={option.note} /> : null}
        </span>
        {variant === 'card' && option.description ? <span className="mt-1 block text-sm text-base-content/70">{option.description}</span> : null}
      </label>
    );
  }

  const separate = options.filter((option) => option.separate);
  const rest = options.filter((option) => !option.separate);
  return (
    <fieldset className="fieldset" aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
      <legend className="fieldset-legend">
        {label}
        {legendExtra ? <span className="font-normal text-base-content/70"> · {legendExtra}</span> : null}
      </legend>
      {separate.length > 0 ? <div>{separate.map(optionLabel)}</div> : null}
      <div className={variant === 'card' ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : 'flex flex-wrap gap-2'}>{rest.map(optionLabel)}</div>
      {hint ? (
        <p id={`${name}-hint`} className="label whitespace-normal">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={`${name}-error`}>{error}</FieldError> : null}
    </fieldset>
  );
}
