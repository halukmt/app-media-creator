import { useEffect, useRef, useState } from 'react';
import { ApiError, downloadExport, fetchChecklist, type CatalogueLocale, type Checklist, type ProjectSettings } from '../api';
import { BusyButton } from '../components/BusyButton';
import { ChecklistCard } from '../components/ChecklistCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
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

type Load = { kind: 'loading' } | { kind: 'failed'; messages: string[] } | { kind: 'ready'; checklist: Checklist };
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export section: checklist per store for the selected languages and the ZIP download. */
export function ExportPage({ project, locales, selection, onSelectionChange, focusHeading }: Props) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [download, setDownload] = useState<Download>({ kind: 'idle' });
  const [confirming, setConfirming] = useState(false);
  const downloadButton = useRef<HTMLButtonElement>(null);

  // Reload whenever the languages or the saved project change; an older request never overwrites a newer one.
  useEffect(() => {
    if (selection.length === 0) return undefined;
    const controller = new AbortController();
    setLoad({ kind: 'loading' });
    fetchChecklist(selection, controller.signal)
      .then((checklist) => setLoad({ kind: 'ready', checklist }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoad({ kind: 'failed', messages: error instanceof ApiError ? error.messages : [] });
      });
    return () => controller.abort();
  }, [selection, project]);

  const checklist = load.kind === 'ready' ? load.checklist : null;
  const summary = checklist ? summarizeChecklist(checklist) : null;
  const noTarget = checklist !== null && checklist.targets.length === 0;
  const nothingGenerated = summary !== null && summary.files === 0;

  async function runDownload() {
    if (!checklist) return;
    setConfirming(false);
    setDownload({ kind: 'busy' });
    try {
      const result = await downloadExport(selection);
      const fileName = downloadFileName(result.header, en.export.fallbackFileName);
      saveBlob(result.blob, fileName);
      setDownload({ kind: 'done', fileName, changed: isWorseStatus(result.status, checklist.status) });
    } catch (error) {
      setDownload({ kind: 'failed', messages: error instanceof ApiError ? error.messages : [] });
    }
  }

  function requestDownload() {
    if (checklist?.status === 'error') setConfirming(true);
    else void runDownload();
  }

  function cancelDownload() {
    setConfirming(false);
    downloadButton.current?.focus();
  }

  return (
    <SectionLayout
      section="export"
      focusHeading={focusHeading}
      localeBar={{ options: projectLocaleOptions(locales, project.locales), selection, onChange: onSelectionChange }}
    >
      {noTarget || nothingGenerated ? <SectionEmptyState section="export" project={project} /> : null}

      {!noTarget ? (
        <section aria-labelledby="export-checklist" className="flex flex-col gap-4" aria-busy={load.kind === 'loading'}>
          <h2 id="export-checklist" className="text-xl font-semibold">
            {en.export.checklistHeading}
          </h2>
          {/* Mounted live regions; only the summary is announced, never the whole list. */}
          <div role="status">
            {load.kind === 'loading' ? (
              <p className="flex items-center gap-3">
                <span className="loading loading-spinner" aria-hidden="true" />
                {en.export.checking}
              </p>
            ) : null}
            {checklist && summary ? (
              <StatusAlert announce={false} tone={OVERALL_TONE[checklist.status]} title={en.export.overall[checklist.status]}>
                <p>{en.export.summary(summary.error, summary.warning)}</p>
                {checklist.problems.length > 0 ? (
                  <>
                    <p className="mt-2 font-semibold">{en.export.problemsTitle}</p>
                    <ul className="list-disc pl-5">
                      {checklist.problems.map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </StatusAlert>
            ) : null}
          </div>
          <div role="alert">
            {load.kind === 'failed' ? (
              <StatusAlert announce={false} tone="error" title={en.export.checkFailed}>
                {load.messages.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {load.messages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                ) : null}
              </StatusAlert>
            ) : null}
          </div>
          {checklist ? (
            <div className="grid grid-cols-1 gap-4">
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
          ) : null}
        </section>
      ) : null}

      {checklist && !noTarget && !nothingGenerated ? (
        <section aria-labelledby="export-download" className="flex flex-col gap-3">
          <h2 id="export-download" className="text-xl font-semibold">
            {en.export.downloadHeading}
          </h2>
          {checklist.status === 'error' ? <p className="max-w-prose">{en.export.missingHint}</p> : null}
          <div>
            <BusyButton
              ref={downloadButton}
              primary
              busy={download.kind === 'busy'}
              busyLabel={en.export.downloading}
              disabled={load.kind !== 'ready'}
              onClick={requestDownload}
            >
              {en.export.download}
            </BusyButton>
          </div>
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
          >
            <p>{en.export.confirmBody(summary?.error ?? 0)}</p>
            <p className="mt-2">{en.export.missingHint}</p>
          </ConfirmDialog>
        </section>
      ) : null}
    </SectionLayout>
  );
}
