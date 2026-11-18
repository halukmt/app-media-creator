import { useId } from 'react';
import type { CatalogueLocale, ChecklistItem } from '../api';
import { en } from '../i18n/en';
import { groupBySpec, sortByStatus, type AssetGroup, type CheckStatus } from '../lib/export';
import { RequiredBadge } from './RequiredBadge';
import { StatusBadge } from './StatusBadge';

interface Props {
  title: string;
  status: CheckStatus;
  items: readonly ChecklistItem[];
  /** Catalogue locales, to show language names instead of codes. */
  locales: readonly CatalogueLocale[];
}

/**
 * The export checklist of one store target, grouped per asset: each asset shows its worst status, the required marker
 * and one entry per language; messages appear only for the languages that are not OK. Assets with errors or warnings
 * come first; OK assets are folded into a collapse to keep long lists short.
 */
export function ChecklistCard({ title, status, items, locales }: Props) {
  const titleId = useId();
  const groups = sortByStatus(groupBySpec(items));
  const open = groups.filter((group) => group.status !== 'ok');
  const ok = groups.filter((group) => group.status === 'ok');

  function localeName(id: string | undefined): string {
    if (!id) return en.export.shared;
    return locales.find((locale) => locale.id === id)?.name ?? id;
  }

  function messages(item: ChecklistItem) {
    if (item.messages.length === 0) return null;
    return (
      <ul className="flex flex-col gap-1 text-sm [overflow-wrap:anywhere]">
        {item.messages.map((message, index) => (
          <li key={index}>
            <span className="font-semibold">{en.status[message.level]}:</span> {message.text}
          </li>
        ))}
      </ul>
    );
  }

  function groupRow(group: AssetGroup<ChecklistItem>) {
    const first = group.items[0];
    if (!first) return null;
    const localized = group.items.some((item) => item.locale !== undefined);
    const files = group.items.reduce((sum, item) => sum + item.files.length, 0);
    const withMessages = group.items.filter((item) => item.messages.length > 0);
    return (
      <li key={group.specId} className="list-row items-start px-0">
        {/* Fixed column, so the text starts at the same place after every badge. */}
        <span className="w-18 shrink-0">
          <StatusBadge status={group.status} />
        </span>
        <div className="list-col-grow flex min-w-0 flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span>{first.name}</span>
            {first.required ? <RequiredBadge /> : null}
          </p>
          <p className="text-sm text-base-content/70">
            {localized ? '' : `${en.export.shared} · `}
            {en.export.fileCount(files)}
          </p>
          {localized ? (
            <>
              <ul className="flex flex-wrap gap-2" aria-label={en.export.languagesOf(first.name)}>
                {group.items.map((item) => (
                  <li key={item.locale} className="flex items-center gap-1 text-sm">
                    <span>{localeName(item.locale)}</span>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
              {/* The language badges already show the state; the per-language messages are details on demand. */}
              {withMessages.length > 0 ? (
                <details className="collapse collapse-arrow border border-base-300">
                  <summary className="collapse-title min-h-11 text-sm font-medium">
                    {en.export.messageDetails(withMessages.length)}
                  </summary>
                  <div className="collapse-content flex flex-col gap-2">
                    {withMessages.map((item) => (
                      <div key={`m-${item.locale}`} className="flex flex-col gap-1">
                        <p className="text-sm font-semibold">{localeName(item.locale)}</p>
                        {messages(item)}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            messages(first)
          )}
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
        {groups.length === 0 ? <p className="text-sm">{en.export.noItems}</p> : null}
        {open.length > 0 ? <ul className="list">{open.map(groupRow)}</ul> : null}
        {ok.length > 0 ? (
          <details className="collapse collapse-arrow border border-base-300" open={open.length === 0}>
            <summary className="collapse-title min-h-11 font-medium">{en.export.okItems(ok.length)}</summary>
            <div className="collapse-content">
              <ul className="list">{ok.map(groupRow)}</ul>
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
