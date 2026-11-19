import { useEffect, useRef, useState } from 'react';
import { downloadExport, fetchChecklist, messagesOf, type CatalogueLocale, type Checklist, type ProjectSettings } from '../api';
import { BusyButton } from '../components/BusyButton';
import { ChecklistCard } from '../components/ChecklistCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ProgressStatus } from '../components/ProgressStatus';
import { SectionEmptyState } from '../components/SectionEmptyState';
import { StatusAlert } from '../components/StatusAlert';
import { en } from '../i18n/en';
import { SectionLayout } from '../layouts/SectionLayout';
import { downloadFileName, isWorseStatus, summarizeChecklist } from '../lib/export';
import { projectLocaleOptions } from '../lib/locale-selection';

interface Props {
  project: ProjectSettings;
  locales: readonly CatalogueLocale[];
  selection: readonly string[];
  onSelectionChange: (next: string[]) => void;
  focusHeading: boolean;
}

type Download =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; fileName: string; changed: boolean }
  | { kind: 'failed'; messages: string[] };

const OVERALL_TONE = { ok: 'success', warning: 'warning', error: 'error' } as const;

/** Saves a blob under a file name through a temporary link; the object URL is released right after. */
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Generous delay: some browsers start reading the URL only after the click handler has returned.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Export section: checklist per store for the selected languages and the ZIP download. */
export function ExportPage({ project, locales, selection, onSelectionChange, focusHeading }: Props) {
  // The last loaded checklist stays visible while a new one loads, so the page does not jump.
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string[] | null>(null);
  const [download, setDownload] = useState<Download>({ kind: 'idle' });
  const [confirming, setConfirming] = useState(false);
  const downloadButton = useRef<HTMLButtonElement>(null);
  // The running download, if any: at most one at a time, and it belongs to the selection it was started with.
  const runningDownload = useRef<AbortController | null>(null);
  // Never send an empty list (the server would reject it); fall back to every project language.
  const exportLocales = selection.length > 0 ? selection : project.locales;
  // Compared by content: a click that leaves the languages as they were gives a new array but changes nothing.
  const localeKey = exportLocales.join(',');

  // Reload whenever the languages or the saved project change; an older request never overwrites a newer one.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    setDownload({ kind: 'idle' });
    fetchChecklist(localeKey.split(','), controller.signal)
      .then((next) => {
        setChecklist(next);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setChecklist(null);
        setLoading(false);
        setLoadError(messagesOf(error));
      });
    return () => {
      controller.abort();
      // A download for another selection, or one left behind with the page, is neither saved nor shown.
      runningDownload.current?.abort();
      runningDownload.current = null;
    };
  }, [localeKey, project]);

  const summary = checklist ? summarizeChecklist(checklist) : null;
  const noTarget = checklist !== null && checklist.targets.length === 0;
  const nothingGenerated = summary !== null && summary.files === 0;

  async function runDownload() {
    if (!checklist || loading || runningDownload.current) return;
    const controller = new AbortController();
    runningDownload.current = controller;
    setConfirming(false);
    setDownload({ kind: 'busy' });
    try {
      const result = await downloadExport(exportLocales, controller.signal);
      // The selection changed while the body was still arriving: drop the ZIP of the old selection.
      if (controller.signal.aborted) return;
      const fileName = downloadFileName(result.header, en.export.fallbackFileName);
      saveBlob(result.blob, fileName);
      setDownload({ kind: 'done', fileName, changed: isWorseStatus(result.status, checklist.status) });
    } catch (error) {
      if (controller.signal.aborted) return;
      setDownload({ kind: 'failed', messages: messagesOf(error) });
    } finally {
      // Only the run that registered itself clears the slot; an aborted run never clears a newer one.
      if (runningDownload.current === controller) runningDownload.current = null;
    }
  }

  function requestDownload() {
    if (checklist?.status === 'error') setConfirming(true);
    else void runDownload();
  }

  function cancelDownload() {
    setConfirming(false);
  }

  const ready = checklist !== null && !noTarget && !nothingGenerated;

  return (
    <SectionLayout
      section="export"
      focusHeading={focusHeading}
      localeBar={{ options: projectLocaleOptions(locales, project.locales), selection, onChange: onSelectionChange }}
    >
      {noTarget || nothingGenerated ? <SectionEmptyState section="export" project={project} /> : null}

      {/* Status and the one primary action first; the per-store details follow below. */}
      <section aria-labelledby="export-download" className="flex flex-col gap-3">
        <h2 id="export-download" className="text-xl font-semibold">
          {en.export.downloadHeading}
        </h2>
        {/* Mounted live regions; only the loading line and the one-line summary are announced, never the lists. */}
        <div role="status">
          {loading ? (
            <ProgressStatus label={en.export.checking} />
          ) : null}
          {!loading && checklist && summary && !noTarget ? (
            <StatusAlert announce={false} tone={OVERALL_TONE[checklist.status]} title={en.export.overall[checklist.status]}>
              <p>{en.export.summary(summary.error, summary.warning)}</p>
            </StatusAlert>
          ) : null}
        </div>
        <div role="alert">
          {loadError ? (
            <StatusAlert announce={false} tone="error" title={en.export.checkFailed}>
              {loadError.length > 0 ? (
                <ul className="list-disc pl-5">
                  {loadError.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              ) : null}
            </StatusAlert>
          ) : null}
        </div>
        {checklist && checklist.problems.length > 0 ? (
          <StatusAlert announce={false} tone="error" title={en.export.problemsTitle}>
            <ul className="list-disc pl-5 wrap-anywhere">
              {checklist.problems.map((problem, index) => (
                <li key={index}>{problem}</li>
              ))}
            </ul>
          </StatusAlert>
        ) : null}
        {ready ? (
          <>
            {checklist.status === 'error' ? <p className="max-w-prose">{en.export.missingHint}</p> : null}
            <div>
              <BusyButton
                ref={downloadButton}
                primary
                busy={download.kind === 'busy'}
                busyLabel={en.export.downloading}
                disabled={loading}
                onClick={requestDownload}
              >
                {en.export.download}
              </BusyButton>
            </div>
          </>
        ) : null}
        <div role="status">
          {download.kind === 'done' ? (
            <StatusAlert announce={false} tone={download.changed ? 'warning' : 'success'} title={en.export.downloaded(download.fileName)}>
              {download.changed ? <p>{en.export.statusChanged}</p> : null}
            </StatusAlert>
          ) : null}
        </div>
        <div role="alert">
          {download.kind === 'failed' ? (
            <StatusAlert announce={false} tone="error" title={en.export.downloadFailed}>
              {download.messages.length > 0 ? <p>{download.messages.join(' ')}</p> : null}
            </StatusAlert>
          ) : null}
        </div>
        <ConfirmDialog
          open={confirming}
          title={en.export.confirmTitle}
          confirmLabel={en.export.confirmAction}
          cancelLabel={en.export.cancel}
          onConfirm={() => void runDownload()}
          onCancel={cancelDownload}
          returnFocus={downloadButton}
        >
          <p>{en.export.confirmBody(summary?.error ?? 0)}</p>
          <p className="mt-2">{en.export.missingHint}</p>
        </ConfirmDialog>
      </section>

      {checklist && !noTarget ? (
        <section aria-labelledby="export-checklist" className="flex flex-col gap-4">
          <h2 id="export-checklist" className="text-xl font-semibold">
            {en.export.checklistHeading}
          </h2>
          <div className="grid grid-cols-1 gap-4" aria-busy={loading}>
            {checklist.targets.map((target) => (
              <ChecklistCard
                key={target.target}
                title={en.targets[target.target]}
                status={target.status}
                items={target.items}
                locales={locales}
              />
            ))}
          </div>
        </section>
      ) : null}
    </SectionLayout>
  );
}
