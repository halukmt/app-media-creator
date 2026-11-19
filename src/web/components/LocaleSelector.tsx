import { en } from '../i18n/en';
import type { CatalogueLocale } from '../api';
import { chooseLocale, isAllSelected, selectAll } from '../lib/locale-selection';
import { OptionGroup } from './OptionGroup';

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

const ALL = '__all';

/**
 * The one locale control of the app (L3): an OptionGroup of the locales, plus "All languages" in multiple mode.
 * The selection never becomes empty in multiple mode.
 */
export function LocaleSelector({ label, options, value, onChange, mode, hint, error }: Props) {
  const multiple = mode === 'multiple';
  const offered = options.map((option) => option.id);
  const allSelected = isAllSelected(value, offered);

  return (
    <OptionGroup
      label={label}
      multiple={multiple}
      legendExtra={multiple ? en.locales.selectedCount(value.length, offered.length) : undefined}
      options={[
        // Stays enabled when everything is selected, so keyboard focus is not lost; choosing it again is a no-op.
        ...(multiple ? [{ id: ALL, label: en.locales.all, separate: true }] : []),
        ...options.map((option) => ({
          id: option.id,
          label: option.name,
          ...(option.nativeName !== option.name ? { secondary: option.nativeName, lang: option.id } : {}),
        })),
      ]}
      value={allSelected ? [ALL, ...value] : value}
      onSelect={(id) => onChange(id === ALL ? selectAll(offered) : chooseLocale(value, id, offered, multiple))}
      {...(hint ? { hint } : {})}
      {...(error ? { error } : {})}
    />
  );
}
