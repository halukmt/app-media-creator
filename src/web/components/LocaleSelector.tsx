import { useId } from 'react';
import { en } from '../i18n/en';
import type { CatalogueLocale } from '../api';
import { chooseLocale, isAllSelected, selectAll } from '../lib/locale-selection';
import { FieldError } from './FieldError';

interface Props {
  label: string;
  options: readonly CatalogueLocale[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  /** `single` selects exactly one locale ("this language"); `multiple` toggles locales and offers "All languages". */
  mode: 'single' | 'multiple';
  hint?: string;
  error?: string;
}

// Unselected: light outline. Selected: active fill, strong border and a check mark, so the state does not rely on
// colour alone. The focus ring uses the text colour of the theme, visible on both states.
const OPTION_CLASS =
  'group btn btn-outline min-h-11 h-auto py-2 border-base-300 font-medium ' +
  'has-[:checked]:btn-active has-[:checked]:border-base-content ' +
  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-base-content';

function CheckMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="hidden size-4 group-has-[:checked]:block" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The one locale control of the app (L3). Each locale is a native checkbox or radio inside a button-styled
 * label, so keyboard and screen readers get standard controls; the options wrap on narrow screens.
 */
export function LocaleSelector({ label, options, value, onChange, mode, hint, error }: Props) {
  const name = useId();
  const multiple = mode === 'multiple';
  const offered = options.map((option) => option.id);
  const allSelected = isAllSelected(value, offered);
  const describedBy = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(' ') || undefined;

  return (
    <fieldset className="fieldset" aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
      <legend className="fieldset-legend">
        {label}
        {multiple ? <span className="font-normal text-base-content/70"> · {en.locales.selectedCount(value.length, offered.length)}</span> : null}
      </legend>
      {multiple ? (
        <div>
          <label className={`${OPTION_CLASS} btn-sm`}>
            {/* Stays enabled when everything is selected, so keyboard focus is not lost; choosing it again is a no-op. */}
            <input type="checkbox" className="sr-only" checked={allSelected} onChange={() => onChange(selectAll(offered))} />
            <CheckMark />
            {en.locales.all}
          </label>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.id} className={OPTION_CLASS}>
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={multiple ? undefined : name}
              className="sr-only"
              value={option.id}
              checked={value.includes(option.id)}
              onChange={() => onChange(chooseLocale(value, option.id, offered, multiple))}
            />
            <CheckMark />
            <span>{option.name}</span>
            {option.nativeName !== option.name ? (
              <span className="text-xs font-normal opacity-80" lang={option.id}>
                {option.nativeName}
              </span>
            ) : null}
          </label>
        ))}
      </div>
      {hint ? (
        <p id={`${name}-hint`} className="label whitespace-normal">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={`${name}-error`}>{error}</FieldError> : null}
    </fieldset>
  );
}
