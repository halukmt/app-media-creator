import { useId, useState } from 'react';
import {
  applyJob,
  createJob,
  fetchStoreTexts,
  messagesOf,
  saveStoreTexts,
  type Catalogue,
  type ProjectSettings,
  type StoreTextField,
  type StoreTexts,
} from '../api';
import { AiJobPanel, type AiJobMessage } from '../components/AiJobPanel';
import { AiResultCard } from '../components/AiResultCard';
import { ProgressStatus } from '../components/ProgressStatus';
import { SaveStatus } from '../components/SaveStatus';
import { SectionEmptyState } from '../components/SectionEmptyState';
import { StatusAlert } from '../components/StatusAlert';
import { StoreTextsCard } from '../components/StoreTextsCard';
import { useAiJob } from '../hooks/useAiJob';
import { useRevisionAutosave } from '../hooks/useRevisionAutosave';
import { en } from '../i18n/en';
import { SectionLayout } from '../layouts/SectionLayout';
import { projectLocaleOptions } from '../lib/locale-selection';
import { storeTextLocales } from '../lib/ai-jobs';
import { sectionHref } from '../lib/sections';
import { isOverLimit, storeGroups, textLength, withText } from '../lib/store-texts';

interface Props {
  project: ProjectSettings;
  catalogue: Catalogue;
  selection: readonly string[];
  onSelectionChange: (next: string[]) => void;
  focusHeading: boolean;
}

/**
 * The Store texts section: per selected language and enabled store, the listing fields with live counters and the
 * server's checks, saved automatically; and the AI job that writes them.
 */
export function StoreTextsPage({ project, catalogue, selection, onSelectionChange, focusHeading }: Props) {
  const textsHeadingId = useId();
  // The texts as the server last answered them: its checks belong to these values only.
  const [checked, setChecked] = useState<Pick<StoreTexts, 'texts' | 'checks'>>({ texts: {}, checks: {} });
  const autosave = useRevisionAutosave<StoreTexts>({
    section: 'store-texts',
    load: fetchStoreTexts,
    documentOf: (loaded) => loaded,
    save: saveStoreTexts,
    onServerDocument: (stored) => setChecked({ texts: stored.texts, checks: stored.checks }),
  });
  const { document, saveState, loadError, editsLocked } = autosave;
  const { job: aiJob, showJob, refreshJob } = useAiJob('store-texts');
  const [aiBusy, setAiBusy] = useState<'prepare' | 'apply' | null>(null);
  const [aiMessage, setAiMessage] = useState<AiJobMessage | null>(null);

  const localeName = (id: string) => catalogue.locales.find((locale) => locale.id === id)?.name ?? id;
  const stores = storeGroups(catalogue.storeTexts, { apple: project.targets.apple.enabled, google: project.targets.google.enabled });
  const shownLocales = project.locales.filter((locale) => selection.includes(locale));

  function updateText(locale: string, field: StoreTextField, text: string) {
    if (!document) return;
    autosave.update({ ...document, texts: withText(document.texts, locale, field, text) });
  }

  async function prepareAiJob() {
    setAiMessage(null);
    // The job must contain what the user sees: send pending edits first.
    try {
      await autosave.flush();
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
    setAiBusy('apply');
    try {
      const saved = await autosave.applyLocked(async () => {
        try {
          await applyJob(aiJob.id);
          showJob({ ...aiJob, status: 'applied', applied: { at: new Date().toISOString() } });
        } catch (error) {
          setAiMessage({ action: 'apply', tone: 'error', text: en.storeTexts.ai.applyFailed, details: messagesOf(error) });
        } finally {
          refreshJob(aiJob.id);
        }
      });
      if (!saved) setAiMessage({ action: 'apply', tone: 'error', text: en.storeTexts.saveFirst });
    } catch (error) {
      setAiMessage({ action: 'apply', tone: 'error', text: en.storeTexts.ai.applyFailed, details: messagesOf(error) });
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
                  <button type="button" className="btn min-h-11" onClick={() => void autosave.reload()}>
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
