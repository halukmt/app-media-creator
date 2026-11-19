import { useId } from 'react';
import { en } from '../i18n/en';

export interface AiResultText {
  /** Small marker above the text, e.g. "Variant A". */
  label?: string;
  main: string;
  sub?: string;
}

export interface AiResultRow {
  title: string;
  /** One text (a store text) or two side by side from `sm` (headline variants A and B). */
  texts: readonly AiResultText[];
  /** Long text (a description): shown in a collapse, so six languages do not flood the page. */
  long?: boolean;
}

interface Props {
  localeName: string;
  /** Media locale of the texts, for spelling and pronunciation. */
  locale: string;
  rows: readonly AiResultRow[];
}

// Static class names: Tailwind cannot see class names built at runtime.
const COLUMNS: Record<number, string> = {
  1: 'sm:grid-cols-[minmax(8rem,auto)_1fr]!',
  2: 'sm:grid-cols-[auto_1fr_1fr]!',
};

function Text({ text, locale }: { text: AiResultText; locale: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {text.label ? <span className="badge badge-sm badge-outline">{text.label}</span> : null}
      <p lang={locale} className="font-semibold wrap-anywhere whitespace-pre-line">
        {text.main}
      </p>
      {text.sub ? (
        <p lang={locale} className="text-sm text-base-content/80 wrap-anywhere">
          {text.sub}
        </p>
      ) : null}
    </div>
  );
}

/** One language of an AI result, read-only: per row a title and its texts (headline variants or a store text). */
export function AiResultCard({ localeName, locale, rows }: Props) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="card card-border card-sm bg-base-100">
      <div className="card-body">
        <h4 id={headingId} className="card-title text-base">
          {localeName}
        </h4>
        <ol className="list">
          {rows.map((row, index) => (
            <li
              key={index}
              className={`list-row grid-flow-row! grid-cols-1! gap-2 *:row-start-auto! sm:grid-flow-col! sm:*:row-start-1! ${COLUMNS[Math.min(row.texts.length, 2)] ?? COLUMNS[1]}`}
            >
              <span className="text-sm text-base-content/70">{row.title}</span>
              {row.long ? (
                <details className="collapse collapse-arrow min-w-0 border border-base-300">
                  <summary className="collapse-title min-h-11 text-sm font-medium">{en.common.showText}
                    <span className="sr-only">: {row.title}</span>
                  </summary>
                  <div className="collapse-content">
                    {row.texts.map((text, textIndex) => (
                      <Text key={textIndex} text={text} locale={locale} />
                    ))}
                  </div>
                </details>
              ) : (
                row.texts.map((text, textIndex) => <Text key={textIndex} text={text} locale={locale} />)
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
