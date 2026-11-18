import { useId } from 'react';
import type { CatalogueLocale, ChecklistItem } from '../api';
import { en } from '../i18n/en';
import { sortByStatus, type CheckStatus } from '../lib/export';
import { StatusBadge } from './StatusBadge';

interface Props {
  title: string;
  status: CheckStatus;
  items: readonly ChecklistItem[];
  /** Catalogue locales, to show language names instead of codes. */
  locales: readonly CatalogueLocale[];
}

/**
 * The export checklist of one store target: every asset set with language, required marker, file count, status and
 * messages. Sets with errors or warnings come first; OK sets are folded into a collapse to keep long lists short.
 */
export function ChecklistCard({ title, status, items, locales }: Props) {
  const titleId = useId();
  const sorted = sortByStatus(items);
  const open = sorted.filter((item) => item.status !== 'ok');
  const ok = sorted.filter((item) => item.status === 'ok');

  function localeName(id: string | undefined): string {
    if (!id) return en.export.shared;
    return locales.find((locale) => locale.id === id)?.name ?? id;
  }

  function row(item: ChecklistItem) {
    return (
      <li key={`${item.specId}-${item.locale ?? 'shared'}`} className="list-row items-start px-0">
        <StatusBadge status={item.status} />
        <div className="list-col-grow min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span>{item.name}</span>
            {item.required ? <span className="badge badge-sm badge-outline">{en.target.required}</span> : null}
          </p>
          <p className="text-sm text-base-content/70">
            {localeName(item.locale)} · {en.export.fileCount(item.files.length)}
          </p>
          {item.messages.length > 0 ? (
            <ul className="mt-1 flex flex-col gap-1 text-sm [overflow-wrap:anywhere]">
              {item.messages.map((message, index) => (
                <li key={index}>
                  <span className="font-semibold">{en.status[message.level]}:</span> {message.text}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <section className="card card-border bg-base-100" aria-labelledby={titleId}>
      <div className="card-body gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={titleId} className="card-title text-base">
            {title}
          </h3>
          <StatusBadge status={status} />
        </div>
        {open.length > 0 ? <ul className="list">{open.map(row)}</ul> : null}
        {ok.length > 0 ? (
          <details className="collapse collapse-arrow border border-base-300" open={open.length === 0}>
            <summary className="collapse-title min-h-11 font-medium">{en.export.okItems(ok.length)}</summary>
            <div className="collapse-content">
              <ul className="list">{ok.map(row)}</ul>
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
