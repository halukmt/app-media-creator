import { useId } from 'react';
import type { CopyText } from '../api';
import { en } from '../i18n/en';

interface Props {
  localeName: string;
  /** Media locale of the texts, for spelling and pronunciation. */
  locale: string;
  slots: readonly { title: string; A: CopyText; B: CopyText }[];
}

/** One language of an AI result: per screenshot slot, variant A and B (headline and subline), side by side from `sm`. */
export function HeadlineVariantsCard({ localeName, locale, slots }: Props) {
  const headingId = useId();
  const variant = (name: 'A' | 'B', text: CopyText) => (
    <div className="flex flex-col gap-0.5">
      <span className="badge badge-sm badge-outline">{en.screenshots.ai.variant(name)}</span>
      <p lang={locale} className="font-semibold wrap-anywhere">
        {text.headline}
      </p>
      {text.subline ? (
        <p lang={locale} className="text-sm text-base-content/80 wrap-anywhere">
          {text.subline}
        </p>
      ) : null}
    </div>
  );
  return (
    <section aria-labelledby={headingId} className="card card-border card-sm bg-base-100">
      <div className="card-body">
        <h4 id={headingId} className="card-title text-base">
          {localeName}
        </h4>
        <ol className="list">
          {slots.map((slot, index) => (
            <li key={index} className="list-row grid-flow-row! grid-cols-1! gap-2 *:row-start-auto! sm:grid-flow-col! sm:grid-cols-[auto_1fr_1fr]! sm:*:row-start-1!">
              <span className="text-sm text-base-content/70">{slot.title}</span>
              {variant('A', slot.A)}
              {variant('B', slot.B)}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
