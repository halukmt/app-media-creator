import { useId } from 'react';
import { en } from '../i18n/en';
import type { CatalogueLocale } from '../api';
import { chooseLocale, isAllSelected, selectAll } from '../lib/locale-selection';

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

const OPTION_CLASS =
  'btn min-h-11 h-auto py-2 has-[:checked]:btn-neutral has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2';

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
    <fieldset className="fieldset" aria-describedby={describedBy}>
      <legend className="fieldset-legend">
        {label}
        {multiple ? <span className="font-normal text-base-content/70"> · {en.locales.selectedCount(value.length, offered.length)}</span> : null}
      </legend>
      <div className="flex flex-wrap gap-2">
        {multiple ? (
          <label className={OPTION_CLASS}>
            <input
              type="checkbox"
              className="sr-only"
              checked={allSelected}
              disabled={allSelected}
              onChange={() => onChange(selectAll(offered))}
            />
            {en.locales.all}
          </label>
        ) : null}
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
      {error ? (
        <p id={`${name}-error`} className="border-l-4 border-error pl-2 text-sm font-medium">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
