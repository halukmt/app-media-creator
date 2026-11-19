import { useId } from 'react';
import type { StoreTextField, StoreTextMessage, StoreTextSpec } from '../api';
import { en } from '../i18n/en';
import { isOverLimit, textLength } from '../lib/store-texts';
import { TextField } from './TextField';

interface Props {
  locale: string;
  localeName: string;
  /** The enabled stores with their fields in paste order. */
  stores: readonly { target: 'apple' | 'google'; fields: readonly StoreTextSpec[] }[];
  values: Readonly<Partial<Record<StoreTextField, string>>>;
  /** Check messages of the server, per field (only for the texts as last saved). */
  checks: Readonly<Partial<Record<StoreTextField, readonly StoreTextMessage[]>>>;
  disabled: boolean;
  onChange: (field: StoreTextField, text: string) => void;
}

/** One language of the store texts: per enabled store a fieldset with its fields, counters and check messages. */
export function StoreTextsCard({ locale, localeName, stores, values, checks, disabled, onChange }: Props) {
  const headingId = useId();
  const t = en.storeTexts;
  return (
    <section aria-labelledby={headingId} className="card card-border bg-base-100">
      <div className="card-body gap-4">
        <h3 id={headingId} className="card-title text-lg">
          {localeName}
        </h3>
        {stores.map((store) => (
          <fieldset key={store.target} className="fieldset gap-3">
            <legend className="fieldset-legend text-base">{en.targets[store.target]}</legend>
            {store.fields.map((spec) => {
              const value = values[spec.field] ?? '';
              const length = textLength(spec, value);
              const over = isOverLimit(spec, value);
              const messages = checks[spec.field] ?? [];
              // The server's error already says the length; the counter then shows the plain count.
              const counterText = over && !messages.some((m) => m.level === 'error') ? t.counterOver(length, spec.max, spec.unit) : t.counter(length, spec.max, spec.unit);
              const hint = [spec.notes, spec.unit === 'bytes' ? t.bytesHint : undefined].filter(Boolean).join(' ');
              return (
                <TextField
                  key={spec.field}
                  label={spec.name}
                  value={value}
                  lang={locale}
                  multiline={spec.multiline}
                  rows={spec.max <= 200 ? 3 : 5}
                  required={spec.required}
                  {...(hint ? { hint } : {})}
                  counter={{ text: counterText, over }}
                  messages={messages}
                  disabled={disabled}
                  onChange={(text) => onChange(spec.field, text)}
                />
              );
            })}
          </fieldset>
        ))}
      </div>
    </section>
  );
}
