import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ApiError,
  JOB_EVENTS_URL,
  applyJob,
  createJob,
  fetchJob,
  fetchJobs,
  fetchStoreTexts,
  saveStoreTexts,
  type AiJob,
  type Catalogue,
  type ProjectSettings,
  type StoreTextField,
  type StoreTexts,
} from '../api';
import { AiJobPanel, type AiJobMessage } from '../components/AiJobPanel';
import { AiResultCard } from '../components/AiResultCard';
import { ProgressStatus } from '../components/ProgressStatus';
import { SaveStatus, type SaveState } from '../components/SaveStatus';
import { SectionEmptyState } from '../components/SectionEmptyState';
import { StatusAlert } from '../components/StatusAlert';
import { StoreTextsCard } from '../components/StoreTextsCard';
import { en } from '../i18n/en';
import { SectionLayout } from '../layouts/SectionLayout';
import { projectLocaleOptions } from '../lib/locale-selection';
import { storeTextLocales } from '../lib/ai-jobs';
import { SaveDiscardedError, createSaveQueue } from '../lib/save-queue';
import { sectionHref } from '../lib/sections';
import { isOverLimit, storeGroups, textLength, withText } from '../lib/store-texts';

interface Props {
  project: ProjectSettings;
  catalogue: Catalogue;
  selection: readonly string[];
  onSelectionChange: (next: string[]) => void;
  focusHeading: boolean;
}

const SAVE_DELAY = 600;

/** The server refused a save because the texts changed elsewhere. */
function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

function messagesOf(error: unknown): string[] {
  return error instanceof ApiError ? error.messages : [];
}

/**
 * The Store texts section: per selected language and enabled store, the listing fields with live counters and the
 * server's checks, saved automatically; and the AI job that writes them.
 */
export function StoreTextsPage({ project, catalogue, selection, onSelectionChange, focusHeading }: Props) {
  const textsHeadingId = useId();
  const [document, setDocument] = useState<StoreTexts | null>(null);
  // The texts as the server last answered them: its checks belong to these values only.
  const [checked, setChecked] = useState<Pick<StoreTexts, 'texts' | 'checks'>>({ texts: {}, checks: {} });
  const [loadError, setLoadError] = useState<string[] | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const knownRevision = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aiJob, setAiJob] = useState<AiJob | null>(null);
  const [aiBusy, setAiBusy] = useState<'prepare' | 'apply' | null>(null);
  const [aiMessage, setAiMessage] = useState<AiJobMessage | null>(null);
  const jobVersion = useRef(0);
  const showJob = useCallback((job: AiJob | null) => {
    jobVersion.current += 1;
    setAiJob(job);
  }, []);
  const refreshJob = useCallback((id: string) => {
    const version = (jobVersion.current += 1);
    void fetchJob(id)
      .then((fetched) => {
        if (version === jobVersion.current) setAiJob(fetched);
      })
      .catch(() => undefined);
  }, []);

  // Edit lock around applying AI texts, as on the Screenshots page (#84, #87): edits are not taken while an apply runs
  // or until a reload started after it has brought the applied texts.
  const applyRunning = useRef(false);
  const lockedAfter = useRef<number | null>(null);
  const [releaseLock, setReleaseLock] = useState(false);
  const [editsLocked, setEditsLocked] = useState(false);
  const reloadCount = useRef(0);

  const localeName = (id: string) => catalogue.locales.find((locale) => locale.id === id)?.name ?? id;
  const stores = storeGroups(catalogue.storeTexts, { apple: project.targets.apple.enabled, google: project.targets.google.enabled });
  const shownLocales = project.locales.filter((locale) => selection.includes(locale));

  const queue = useRef(
    createSaveQueue<StoreTexts>(
      async (next) => {
        const saved = await saveStoreTexts({ ...next, revision: knownRevision.current });
        knownRevision.current = Math.max(knownRevision.current, saved.revision);
        setChecked({ texts: saved.texts, checks: saved.checks });
        return saved;
      },
      () => setSaveState('saved'),
      { discardOn: isConflict },
    ),
  );

  /** Loads the texts; resolves false when that failed (the error is shown). */
  const reload = useCallback(async (): Promise<boolean> => {
    const number = (reloadCount.current += 1);
    try {
      const next = await fetchStoreTexts();
      if (number !== reloadCount.current) return false;
      // An answer older than a save this page already made is stale.
      if (next.revision >= knownRevision.current) {
        // The texts moved on elsewhere: an edit still waiting is based on the older version and must not be sent.
        if (next.revision > knownRevision.current && queue.current.discard()) setSaveState('conflict');
        knownRevision.current = next.revision;
        setDocument(next);
        setChecked({ texts: next.texts, checks: next.checks });
      }
      setLoadError(null);
      if (!applyRunning.current && lockedAfter.current !== null && number > lockedAfter.current) setReleaseLock(true);
      return true;
    } catch (error) {
      if (number === reloadCount.current) setLoadError(messagesOf(error));
      return false;
    }
  }, []);

  useEffect(() => {
    void reload();
    fetchJobs('store-texts', 1)
      .then((jobs) => showJob(jobs[0] ?? null))
      .catch(() => showJob(null));
  }, [reload, showJob]);

  // The newest job is followed through the server's event stream.
  const aiJobId = aiJob?.id;
  useEffect(() => {
    if (!aiJobId) return undefined;
    const events = new EventSource(JOB_EVENTS_URL);
    const refresh = () => refreshJob(aiJobId);
    events.addEventListener('job', (event) => {
      if ((event as MessageEvent<string>).data === aiJobId) refresh();
    });
    events.addEventListener('open', refresh);
    return () => events.close();
  }, [aiJobId, refreshJob]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  /** Sends pending edits now; rejects (and keeps them) when the save fails; drops them when they conflict. */
  const flushSave = useCallback(async (): Promise<void> => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      await queue.current.flush();
    } catch (error) {
      if (isConflict(error) || error instanceof SaveDiscardedError) {
        setSaveState('conflict');
        await reloadRef.current();
        return;
      }
      setSaveState('failed');
      throw error;
    }
  }, []);
  useEffect(() => () => void flushSave().catch(() => undefined), [flushSave]);

  useEffect(() => {
    if (!releaseLock) return;
    setReleaseLock(false);
    if (applyRunning.current) return;
    lockedAfter.current = null;
    setEditsLocked(false);
  }, [releaseLock]);

  function updateText(locale: string, field: StoreTextField, text: string) {
    if (!document || applyRunning.current || lockedAfter.current !== null) return;
    const next = { ...document, texts: withText(document.texts, locale, field, text) };
    setDocument(next);
    queue.current.schedule(next);
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flushSave().catch(() => undefined), SAVE_DELAY);
  }

  async function prepareAiJob() {
    setAiMessage(null);
    // The job must contain what the user sees: send pending edits first.
    try {
      await flushSave();
    } catch {
      setAiMessage({ action: 'prepare', tone: 'error', text: en.storeTexts.saveFirst });
      return;
    }
    setAiBusy('prepare');
    try {
      showJob(await createJob('store-texts', shownLocales));
    } catch (error) {
      setAiMessage({ action: 'prepare', tone: 'error', text: en.storeTexts.ai.prepareFailed, details: messagesOf(error) });
    } finally {
      setAiBusy(null);
    }
  }

  async function applyAiJob() {
    if (!aiJob) return;
    setAiMessage(null);
    applyRunning.current = true;
    setEditsLocked(true);
    setAiBusy('apply');
    try {
      await flushSave();
    } catch {
      setAiMessage({ action: 'apply', tone: 'error', text: en.storeTexts.saveFirst });
      applyRunning.current = false;
      setAiBusy(null);
      setEditsLocked(lockedAfter.current !== null);
      if (lockedAfter.current !== null) void reload();
      return;
    }
    try {
      await applyJob(aiJob.id);
      showJob({ ...aiJob, status: 'applied', applied: { at: new Date().toISOString() } });
    } catch (error) {
      setAiMessage({ action: 'apply', tone: 'error', text: en.storeTexts.ai.applyFailed, details: messagesOf(error) });
    } finally {
      // Also after an error: the server may have saved the texts before the answer was lost.
      lockedAfter.current = reloadCount.current;
      refreshJob(aiJob.id);
      applyRunning.current = false;
    }
    try {
      await reload();
    } finally {
      setAiBusy(null);
    }
  }

  const aiLocales = aiJob ? storeTextLocales(aiJob, project.locales) : [];

  return (
    <SectionLayout
      section="store-texts"
      focusHeading={focusHeading}
      localeBar={{ options: projectLocaleOptions(catalogue.locales, project.locales), selection, onChange: onSelectionChange }}
    >
      {stores.length === 0 ? (
        <SectionEmptyState section="store-texts" project={project} />
      ) : (
        <>
          <div role="alert">
            {loadError ? (
              <div className="flex flex-col gap-2">
                <StatusAlert announce={false} tone="error" title={en.storeTexts.loadFailed}>
                  {loadError.length > 0 ? <p className="wrap-anywhere">{loadError.join(' ')}</p> : null}
                </StatusAlert>
                <div>
                  <button type="button" className="btn min-h-11" onClick={() => void reload()}>
                    {en.storeTexts.retry}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <section aria-labelledby={textsHeadingId} className="flex max-w-3xl flex-col gap-4">
            <h2 id={textsHeadingId} className="text-xl font-semibold">
              {en.storeTexts.textsHeading}
            </h2>
            <AiJobPanel
              job={aiJob}
              text={en.storeTexts.ai}
              resultLocales={aiLocales}
              localeName={localeName}
              actions={[
                {
                  id: 'apply',
                  label: en.storeTexts.ai.apply,
                  confirmTitle: en.storeTexts.ai.confirmTitle,
                  confirmBody: en.storeTexts.ai.confirmBody(aiLocales.map(localeName).join(', ')),
                },
              ]}
              preparing={aiBusy === 'prepare'}
              prepareDisabled={shownLocales.length === 0}
              applying={aiBusy === 'apply' ? 'apply' : null}
              message={aiMessage}
              onPrepare={() => void prepareAiJob()}
              onApply={() => void applyAiJob()}
            >
              <p className="text-sm text-base-content/70">{en.storeTexts.ai.previewHint}</p>
              <div className="grid grid-cols-1 gap-3">
                {aiLocales.map((locale) => (
                  <AiResultCard
                    key={locale}
                    locale={locale}
                    localeName={localeName(locale)}
                    rows={catalogue.storeTexts.flatMap((spec) => {
                      const text = aiJob?.storeTexts?.[locale]?.[spec.field];
                      if (!text) return [];
                      const count = isOverLimit(spec, text) ? en.storeTexts.counterOver : en.storeTexts.counter;
                      const title = `${en.targets[spec.target]} · ${spec.name} · ${count(textLength(spec, text), spec.max, spec.unit)}`;
                      return [{ title, texts: [{ main: text }], long: spec.multiline && spec.max > 200 }];
                    })}
                  />
                ))}
              </div>
            </AiJobPanel>
            {shownLocales.length === 0 ? <StatusAlert tone="info" title={en.storeTexts.noLocales} /> : null}
            {document
              ? shownLocales.map((locale) => {
                  const values = document.texts[locale] ?? {};
                  const serverValues = checked.texts[locale] ?? {};
                  const serverChecks = checked.checks[locale] ?? {};
                  // A field's messages belong to the text the server checked; while the user types, only the counter is live.
                  const checks = Object.fromEntries(
                    Object.entries(serverChecks).filter(([field]) => (values[field as StoreTextField] ?? '') === (serverValues[field as StoreTextField] ?? '')),
                  );
                  return (
                    <StoreTextsCard
                      key={locale}
                      locale={locale}
                      localeName={localeName(locale)}
                      stores={stores}
                      values={values}
                      checks={checks}
                      disabled={editsLocked}
                      onChange={(field, text) => updateText(locale, field, text)}
                    />
                  );
                })
              : !loadError ? (
                  <ProgressStatus label={en.common.loading} />
                ) : null}
            {/* Save state and the edit pause stay in view next to the fields while the user types further down. */}
            <div className="sticky bottom-0 z-10 flex flex-col gap-2 bg-base-200 py-2">
              <SaveStatus state={saveState} failedText={en.storeTexts.saveFailed} conflictText={en.storeTexts.changedElsewhere} />
              {editsLocked ? <StatusAlert tone="info" title={en.storeTexts.editsPaused} /> : null}
            </div>
            <div>
              <a href={sectionHref('export')} className="btn btn-primary min-h-11">
                {en.steps.export} →
              </a>
            </div>
          </section>
        </>
      )}
    </SectionLayout>
  );
}
