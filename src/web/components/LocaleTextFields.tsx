import { useId } from 'react';
import type { CatalogueLocale } from '../api';
import { TextField } from './TextField';

interface Props {
  heading: string;
  /** The locales to show a field for, in display order. */
  locales: readonly CatalogueLocale[];
  values: Readonly<Partial<Record<string, string>>>;
  /** Field label for a locale name, e.g. "Tagline (German)". */
  label: (localeName: string) => string;
  hint?: string;
  maxLength?: number;
  onChange: (locale: string, text: string) => void;
}

/** One text field per media locale under a heading, each marked with its language (e.g. taglines, header phrases). */
export function LocaleTextFields({ heading, locales, values, label, hint, maxLength, onChange }: Props) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-lg font-semibold">
        {heading}
      </h3>
      {locales.map((locale) => (
        <TextField
          key={locale.id}
          label={label(locale.name)}
          {...(hint ? { hint } : {})}
          value={values[locale.id] ?? ''}
          {...(maxLength !== undefined ? { maxLength } : {})}
          lang={locale.id}
          onChange={(text) => onChange(locale.id, text)}
        />
      ))}
    </section>
  );
}
