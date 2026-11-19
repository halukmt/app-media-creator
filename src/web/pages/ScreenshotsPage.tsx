import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  applyJob,
  createJob,
  fetchBackgrounds,
  fetchCreativeSettings,
  fetchInputs,
  fetchScreenshots,
  generateCreativeAssets,
  generateFramedScreenshots,
  generateScreenshotCards,
  inputFileUrl,
  messagesOf,
  previewCard,
  previewCreative,
  saveCreativeSettings,
  saveScreenshots,
  uploadScreenshot,
  type BackgroundPreset,
  type Catalogue,
  type CardLayout,
  type CardPreviewResult,
  type CreativePreviewResult,
  type CreativeSettings,
  type ProjectSettings,
  type ScreenshotEntry,
  type ScreenshotSets,
  type StoredInput,
} from '../api';
import { AiJobPanel, type AiJobMessage } from '../components/AiJobPanel';
import { AiResultCard } from '../components/AiResultCard';
import { SaveStatus } from '../components/SaveStatus';
import { BusyButton } from '../components/BusyButton';
import { FileField } from '../components/FileField';
import { LocaleSelector } from '../components/LocaleSelector';
import { LocaleTextFields } from '../components/LocaleTextFields';
import { OptionGroup, type Option } from '../components/OptionGroup';
import { PreviewCard } from '../components/PreviewCard';
import { ProgressStatus } from '../components/ProgressStatus';
import { SectionEmptyState } from '../components/SectionEmptyState';
import { SlotEditor, type SlotValues } from '../components/SlotEditor';
import { StatusAlert } from '../components/StatusAlert';
import { ToggleField } from '../components/ToggleField';
import { useAiJob } from '../hooks/useAiJob';
import { useRevisionAutosave } from '../hooks/useRevisionAutosave';
import { en } from '../i18n/en';
import { SectionLayout } from '../layouts/SectionLayout';
import { headlineLocales } from '../lib/ai-jobs';
import { CREATIVE_PREVIEW_WIDTH, creativeLabelKey, isCreativePurpose, safeAreaPercent, safeAreaShares } from '../lib/creative';
import type { CheckStatus } from '../lib/export';
import { projectLocaleOptions, sourceLocaleFor } from '../lib/locale-selection';
import { pendingSaves } from '../lib/pending-saves';
import { createSaveQueue } from '../lib/save-queue';
import { INHERIT, applyOverrides, backgroundChoices, backgroundKey, moveEntry, overrideIds, removeEntry, swatchCss, uploadName } from '../lib/screenshots';
import { sectionHref } from '../lib/sections';

interface Props {
  project: ProjectSettings;
  catalogue: Catalogue;
  selection: readonly string[];
  onSelectionChange: (next: string[]) => void;
  focusHeading: boolean;
}

type StepId = 'upload' | 'purpose' | 'preview' | 'export';
type Purpose = 'cards' | 'frame' | 'header' | 'feature';
type Message = { tone: 'success' | 'warning' | 'error'; text: string; details?: string[] } | null;

const LAYOUTS: readonly CardLayout[] = ['text-top', 'text-top-large', 'text-bottom'];
const FRAME_KINDS = ['iphone', 'iphone-home', 'iphone-duo', 'ipad', 'android-phone', 'android-tablet'] as const;
const SAVE_DELAY = 600;

/** The Screenshots section: upload per language, choose the purpose, edit headlines and style, preview, generate. */
export function ScreenshotsPage({ project, catalogue, selection, onSelectionChange, focusHeading }: Props) {
  const [step, setStep] = useState<StepId>('upload');
  const [purpose, setPurpose] = useState<Purpose>('cards');
  const [inputs, setInputs] = useState<StoredInput[]>([]);
  const [backgrounds, setBackgrounds] = useState<{ presets: BackgroundPreset[]; palette: BackgroundPreset[] }>({ presets: [], palette: [] });
  const [editLocale, setEditLocale] = useState(project.sourceLocale);
  const [uploadState, setUploadState] = useState<{ done: number; total: number } | null>(null);
  const [uploadMessage, setUploadMessage] = useState<Message>(null);
  const [announce, setAnnounce] = useState('');
  const [device, setDevice] = useState<string>('');
  const [previews, setPreviews] = useState<Record<number, CardPreviewResult | 'failed'>>({});
  const [previewVersion, setPreviewVersion] = useState(0);
  const [generateState, setGenerateState] = useState<{ locale: string; done: number; total: number } | null>(null);
  const [generateMessage, setGenerateMessage] = useState<Message>(null);
  const [frameKind, setFrameKind] = useState<string>('iphone');
  const [shadow, setShadow] = useState(true);
  const [creative, setCreative] = useState<CreativeSettings | null>(null);
  const [creativeSaveState, setCreativeSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [creativePreviews, setCreativePreviews] = useState<Partial<Record<string, CreativePreviewResult | 'failed'>>>({});
  const [creativeLoadFailed, setCreativeLoadFailed] = useState(false);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const creativeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localeOptions = projectLocaleOptions(catalogue.locales, project.locales);
  const editOptions = localeOptions.filter((locale) => selection.includes(locale.id));
  const localeName = (id: string) => catalogue.locales.find((locale) => locale.id === id)?.name ?? id;

  // The editing language follows the language bar: when the bar drops it, fall back to the source or first language.
  useEffect(() => {
    setEditLocale((current) => sourceLocaleFor(selection.includes(current) ? current : project.sourceLocale, selection));
  }, [selection, project.sourceLocale]);

  const loadCreative = useCallback(async () => {
    try {
      setCreative(await fetchCreativeSettings());
      setCreativeLoadFailed(false);
    } catch {
      setCreativeLoadFailed(true);
    }
  }, []);
  // Uploads and screenshot sets load together; the sets carry the revision of the autosave (#85).
  const autosave = useRevisionAutosave<ScreenshotSets, [StoredInput[], ScreenshotSets]>({
    section: 'screenshots',
    load: () => Promise.all([fetchInputs(), fetchScreenshots()]),
    documentOf: ([, loadedSets]) => loadedSets,
    save: saveScreenshots,
    // Uploads are current even when the sets in the same answer are older than a save this page made.
    onLoaded: ([loadedInputs]) => setInputs(loadedInputs.filter((input) => input.kind === 'screenshot')),
    // Texts or styles changed elsewhere: the card previews must show the loaded version (#92).
    onChangedElsewhere: () => setPreviewVersion((v) => v + 1),
    onSaved: () => setPreviewVersion((v) => v + 1),
  });
  // update returns false while AI headlines are applied (the edit is not taken).
  const { document: sets, saveState, loadError, editsLocked, reload, flush: flushSave, update: updateSets } = autosave;
  const { job: aiJob, showJob, refreshJob } = useAiJob('copy');
  const [aiBusy, setAiBusy] = useState<'prepare' | 'A' | 'B' | null>(null);
  const [aiMessage, setAiMessage] = useState<AiJobMessage | null>(null);

  useEffect(() => {
    fetchBackgrounds()
      .then(setBackgrounds)
      .catch(() => setBackgrounds({ presets: [], palette: [] }));
    // A save started when this section was left a moment ago must land first (#98).
    let active = true;
    void pendingSaves.settled().then(() => (active ? loadCreative() : undefined));
    return () => {
      active = false;
    };
  }, [loadCreative]);

  // Devices the project picked for the stores that are enabled.
  const devices = useMemo(() => {
    const picked = (['apple', 'google'] as const).flatMap((target) =>
      project.targets[target].enabled
        ? catalogue.devices[target].filter((d) => project.targets[target].devices.includes(d.id)).map((d) => ({ ...d, target }))
        : [],
    );
    return picked;
  }, [project, catalogue]);
  useEffect(() => {
    if (!devices.some((d) => d.id === device)) setDevice(devices[0]?.id ?? '');
  }, [devices, device]);

  const creativeImages = useMemo(
    () => catalogue.creativeImages.filter((image) => image.group === purpose && project.targets[image.target].enabled),
    [catalogue.creativeImages, purpose, project.targets],
  );

  const ownEntries = sets?.sets[editLocale] ?? [];
  const usesFallback = ownEntries.length === 0 && editLocale !== project.sourceLocale;
  const shownEntries = usesFallback ? (sets?.sets[project.sourceLocale] ?? []) : ownEntries;
  const hasUploads = inputs.length > 0;

  // Header and search image settings: same autosave as the sets, with their own queue.
  const creativeQueue = useRef(
    createSaveQueue<CreativeSettings>(saveCreativeSettings, () => {
      setCreativeSaveState('saved');
      pendingSaves.reportSaved('screenshots');
      setPreviewVersion((v) => v + 1);
    }),
  );
  const flushCreative = useCallback(async (): Promise<void> => {
    if (creativeTimer.current) {
      clearTimeout(creativeTimer.current);
      creativeTimer.current = null;
    }
    try {
      await creativeQueue.current.flush();
    } catch (error) {
      setCreativeSaveState('failed');
      throw error;
    }
  }, []);
  function updateCreative(next: CreativeSettings) {
    setCreative(next);
    creativeQueue.current.schedule(next);
    setCreativeSaveState('saving');
    if (creativeTimer.current) clearTimeout(creativeTimer.current);
    creativeTimer.current = setTimeout(() => void flushCreative().catch(() => undefined), SAVE_DELAY);
  }
  useEffect(() => () => pendingSaves.track('screenshots', flushCreative()), [flushCreative]);

  function updateEntries(entries: ScreenshotEntry[]): boolean {
    if (!sets) return false;
    return updateSets({ ...sets, sets: { ...sets.sets, [editLocale]: entries } });
  }

  // Previews of the editing language on the chosen device, one request at a time; a newer version cancels the rest.
  useEffect(() => {
    if (step !== 'preview' || purpose !== 'cards' || !device || shownEntries.length === 0) return undefined;
    const controller = new AbortController();
    setPreviews({});
    void (async () => {
      for (let index = 0; index < shownEntries.length; index += 1) {
        if (controller.signal.aborted) return;
        try {
          const preview = await previewCard(editLocale, device, index, controller.signal);
          setPreviews((current) => ({ ...current, [index]: preview }));
        } catch {
          if (controller.signal.aborted) return;
          setPreviews((current) => ({ ...current, [index]: 'failed' }));
        }
      }
    })();
    return () => controller.abort();
    // shownEntries changes identity on every edit; previews follow saves (previewVersion) instead of every keystroke.
  }, [step, purpose, device, editLocale, previewVersion, shownEntries.length]);

  // Header, search and universal previews of the editing language, one request at a time.
  // Old previews never stay under another language: they are cleared first, also when there is nothing to render.
  useEffect(() => {
    if (step !== 'preview' || !isCreativePurpose(purpose)) return undefined;
    setCreativePreviews({});
    if (shownEntries.length === 0) return undefined;
    const controller = new AbortController();
    void (async () => {
      for (const image of creativeImages) {
        if (controller.signal.aborted) return;
        try {
          const preview = await previewCreative(editLocale, image.specId, CREATIVE_PREVIEW_WIDTH, controller.signal);
          setCreativePreviews((current) => ({ ...current, [image.specId]: preview }));
        } catch {
          if (controller.signal.aborted) return;
          setCreativePreviews((current) => ({ ...current, [image.specId]: 'failed' }));
        }
      }
    })();
    return () => controller.abort();
  }, [step, purpose, editLocale, previewVersion, shownEntries.length, creativeImages]);

  async function upload(files: File[]) {
    setUploadMessage(null);
    // Store pending edits first: the reload below must not be overwritten by an older save. If they cannot be saved,
    // stop: uploading and reloading now would drop them.
    try {
      await flushSave();
    } catch {
      setUploadMessage({ tone: 'error', text: en.screenshots.saveFirst });
      return;
    }
    const failed: string[] = [];
    setUploadState({ done: 0, total: files.length });
    for (const [index, file] of files.entries()) {
      try {
        await uploadScreenshot(file, editLocale);
      } catch (error) {
        failed.push(`${en.screenshots.uploadFailed(file.name)} ${messagesOf(error).join(' ')}`.trim());
      }
      setUploadState({ done: index + 1, total: files.length });
    }
    setUploadState(null);
    await reload();
    setPreviewVersion((v) => v + 1);
    const ok = files.length - failed.length;
    setUploadMessage(
      failed.length === 0
        ? { tone: 'success', text: en.screenshots.uploaded(ok) }
        : { tone: 'error', text: en.screenshots.uploaded(ok), details: failed },
    );
  }

  async function generate() {
    setGenerateMessage(null);
    // Generate from what the user sees: send pending edits first; if that fails, do not generate from older data.
    try {
      await flushSave();
      if (isCreativePurpose(purpose)) await flushCreative();
    } catch {
      setGenerateMessage({ tone: 'error', text: en.screenshots.saveFirst });
      return;
    }
    const locales = [...selection];
    let files = 0;
    const warnings: string[] = [];
    const skipped: string[] = [];
    try {
      if (purpose === 'frame') {
        setGenerateState({ locale: locales.map(localeName).join(', '), done: 0, total: 1 });
        files = (await generateFramedScreenshots(locales, frameKind, shadow)).length;
      } else {
        // One request per language: real progress, and earlier languages are kept if a later one fails.
        const run = isCreativePurpose(purpose) ? (list: string[]) => generateCreativeAssets(list, purpose) : generateScreenshotCards;
        for (const [index, locale] of locales.entries()) {
          setGenerateState({ locale: localeName(locale), done: index, total: locales.length });
          try {
            const result = await run([locale]);
            files += result.entries.length;
            warnings.push(...result.warnings.map((w) => `${w.path}: ${w.message}`));
            skipped.push(...result.skipped.map(localeName));
          } catch (error) {
            if (error instanceof ApiError && error.status === 400 && error.messages.some((m) => m.startsWith('Upload screenshots'))) {
              skipped.push(localeName(locale));
            } else throw error;
          }
        }
      }
      setGenerateMessage({
        tone: warnings.length > 0 || skipped.length > 0 ? 'warning' : 'success',
        text: en.screenshots.generated(files),
        details: [...(skipped.length > 0 ? [en.screenshots.skipped(skipped.join(', '))] : []), ...warnings],
      });
    } catch (error) {
      setGenerateMessage({ tone: 'error', text: en.screenshots.generateFailed, details: messagesOf(error) });
    } finally {
      setGenerateState(null);
    }
  }

  // Options (labels from the UI strings; colours are data from the server). A stored background that is no longer
  // offered (e.g. a colour of a replaced logo) stays selectable as "Current background", so the shown choice is true.
  const offered = [...backgrounds.presets, ...backgrounds.palette];
  const stored = [...(creative ? [creative.background] : []), ...(sets ? [sets.style.background, ...Object.values(sets.sets).flatMap((entries) => (entries ?? []).flatMap((e) => (e.background ? [e.background] : [])))] : [])];
  const backgroundList = backgroundChoices(offered, stored, en.screenshots.currentBackground);
  const backgroundOptions: Option[] = backgroundList.map((preset) => ({
    id: backgroundKey(preset.background),
    label: preset.name,
    swatch: swatchCss(preset.background),
  }));
  const layoutOptions: Option[] = LAYOUTS.map((layout) => ({ id: layout, label: en.screenshots.layouts[layout] }));
  const inheritOption: Option = { id: INHERIT, label: en.screenshots.inherit };
  const slotFrameOptions: Option[] = [inheritOption, { id: 'device', label: en.screenshots.frameDevice }, { id: 'none', label: en.screenshots.frameNone }];

  async function prepareAiJob() {
    setAiMessage(null);
    // The job must contain what the user sees: send pending edits first.
    try {
      await flushSave();
    } catch {
      setAiMessage({ action: 'prepare', tone: 'error', text: en.screenshots.saveFirst });
      return;
    }
    setAiBusy('prepare');
    try {
      showJob(await createJob('copy', [...selection]));
    } catch (error) {
      setAiMessage({ action: 'prepare', tone: 'error', text: en.screenshots.ai.prepareFailed, details: messagesOf(error) });
    } finally {
      setAiBusy(null);
    }
  }

  async function applyAiJob(variant: 'A' | 'B') {
    if (!aiJob) return;
    setAiMessage(null);
    setAiBusy(variant);
    try {
      const saved = await autosave.applyLocked(async () => {
        try {
          await applyJob(aiJob.id, variant);
          // Applied on the server: show it at once. A failed refresh must not read as a failed apply.
          showJob({ ...aiJob, status: 'applied', applied: { variant, at: new Date().toISOString() } });
        } catch (error) {
          setAiMessage({ action: 'apply', tone: 'error', text: en.screenshots.ai.applyFailed, details: messagesOf(error) });
        } finally {
          refreshJob(aiJob.id);
        }
      });
      if (!saved) setAiMessage({ action: 'apply', tone: 'error', text: en.screenshots.saveFirst });
    } catch (error) {
      setAiMessage({ action: 'apply', tone: 'error', text: en.screenshots.ai.applyFailed, details: messagesOf(error) });
    } finally {
      setAiBusy(null);
    }
  }

  const aiLocales = aiJob ? headlineLocales(aiJob, project.locales) : [];

  const steps = [
    { id: 'upload', label: en.steps.upload },
    { id: 'purpose', label: en.steps.purpose, disabled: !hasUploads },
    // Frame-only screenshots have nothing to edit: the options sit in the purpose step.
    { id: 'preview', label: en.steps.preview, disabled: !hasUploads || purpose === 'frame' },
    { id: 'export', label: en.steps.export, disabled: !hasUploads },
  ];

  function goTo(next: StepId) {
    setStep(next);
    // Move focus to the panel heading of the new step.
    requestAnimationFrame(() => document.getElementById(`step-${next}`)?.focus());
  }

  function say(text: string) {
    // Clear first, so the same text is announced again.
    setAnnounce('');
    requestAnimationFrame(() => setAnnounce(text));
  }

  const deviceName = devices.find((d) => d.id === device)?.name ?? device;
  // Generate button per purpose; the feature purpose names only what the enabled stores get.
  const generateLabel: string = {
    cards: en.screenshots.generate,
    frame: en.screenshots.generateFramed,
    header: en.screenshots.generateHeader,
    feature: creativeImages.some((image) => image.target === 'google') ? en.screenshots.generateFeature : en.screenshots.generateEvents,
  }[purpose];
  const deviceSize = devices.find((d) => d.id === device)?.size;

  function previewFor(index: number, fallbackAlt: string, thumbnail?: string) {
    const preview = previews[index];
    const status: CheckStatus | undefined = preview === undefined ? undefined : preview === 'failed' ? 'error' : preview.warnings.length > 0 ? 'warning' : 'ok';
    const messages = preview === undefined ? [] : preview === 'failed' ? [en.screenshots.previewFailed] : preview.warnings.map((w) => w.message);
    const media =
      preview && preview !== 'failed' ? (
        <img src={preview.image} alt={en.screenshots.previewAlt(deviceName, index + 1)} className="h-auto! w-full rounded object-contain" />
      ) : thumbnail ? (
        <img src={thumbnail} alt={fallbackAlt} className="h-auto! w-full rounded object-contain opacity-60" />
      ) : (
        <div className="skeleton aspect-9/19 w-full" aria-hidden="true" />
      );
    return { media, status, messages };
  }

  return (
    <SectionLayout
      section="screenshots"
      focusHeading={focusHeading}
      steps={{ items: steps, current: step, onSelect: (id) => goTo(id as StepId), unavailableHint: en.steps.unavailable }}
      localeBar={{ options: localeOptions, selection, onChange: onSelectionChange }}
    >
      <div role="alert">
        {loadError ? (
          <StatusAlert announce={false} tone="error" title={en.screenshots.loadFailed}>
            {loadError.length > 0 ? <p>{loadError.join(' ')}</p> : null}
            <button
              type="button"
              className="btn btn-sm min-h-11 mt-2"
              onClick={() => void reload()}
            >
              {en.app.retry}
            </button>
          </StatusAlert>
        ) : null}
      </div>

      {step === 'upload' ? (
        <section aria-labelledby="step-upload" className="flex flex-col gap-4">
          <h2 id="step-upload" tabIndex={-1} className="text-xl font-semibold focus:outline-none">
            {en.steps.upload}
          </h2>
          {!hasUploads ? <SectionEmptyState section="screenshots" project={project} /> : null}
          <LocaleSelector label={en.screenshots.uploadLocaleLabel} mode="single" options={editOptions} value={[editLocale]} onChange={([id]) => id && setEditLocale(id)} />
          <FileField
            label={en.screenshots.uploadLabel}
            accept="image/png,image/jpeg,image/webp"
            multiple
            hint={`${en.screenshots.uploadHint} ${en.screenshots.inSet(ownEntries.length)}`}
            onFiles={(files) => void upload(files)}
            disabled={uploadState !== null}
          />
          <div role="status">
            {uploadState ? <ProgressStatus label={en.screenshots.uploading(uploadState.done, uploadState.total)} value={uploadState.done} max={uploadState.total} /> : null}
            {uploadMessage?.tone === 'success' ? <StatusAlert announce={false} tone="success" title={uploadMessage.text} /> : null}
          </div>
          <div role="alert">
            {uploadMessage?.tone === 'error' ? (
              <StatusAlert announce={false} tone="error" title={uploadMessage.text}>
                <ul className="list-disc pl-5">{uploadMessage.details?.map((d, i) => <li key={i}>{d}</li>)}</ul>
              </StatusAlert>
            ) : null}
          </div>
          {hasUploads ? (
            <div>
              <button type="button" className="btn btn-primary min-h-11" onClick={() => goTo('purpose')}>
                {en.steps.purpose} →
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 'purpose' ? (
        <section aria-labelledby="step-purpose" className="flex flex-col gap-4">
          <h2 id="step-purpose" tabIndex={-1} className="text-xl font-semibold focus:outline-none">
            {en.steps.purpose}
          </h2>
          <OptionGroup
            label={en.screenshots.purposeLabel}
            variant="card"
            value={[purpose]}
            onSelect={(id) => setPurpose(id as Purpose)}
            options={[
              { id: 'cards', label: en.screenshots.purposeCards, description: en.screenshots.purposeCardsHint },
              { id: 'frame', label: en.screenshots.purposeFrame, description: en.screenshots.purposeFrameHint },
              {
                id: 'header',
                label: en.screenshots.purposeHeader,
                description: en.screenshots.purposeHeaderHint,
                ...(project.targets.apple.enabled ? {} : { disabled: true, note: en.screenshots.appleDisabled }),
              },
              {
                id: 'feature',
                label: en.screenshots.purposeFeature,
                description: en.screenshots.purposeFeatureHint,
                ...(project.targets.apple.enabled || project.targets.google.enabled ? {} : { disabled: true, note: en.screenshots.noFeatureStore }),
              },
            ]}
          />
          {purpose === 'frame' ? (
            <>
              <OptionGroup
                label={en.screenshots.frameLabel}
                options={FRAME_KINDS.map((kind) => ({ id: kind, label: en.screenshots.frames[kind] }))}
                value={[frameKind]}
                onSelect={setFrameKind}
              />
              <ToggleField label={en.screenshots.shadowLabel} checked={shadow} onChange={setShadow} />
            </>
          ) : null}
          {isCreativePurpose(purpose) && creativeLoadFailed ? (
            <div role="alert">
              <StatusAlert announce={false} tone="error" title={en.screenshots.headerLoadFailed}>
                <button type="button" className="btn btn-sm min-h-11 mt-2" onClick={() => void loadCreative()}>
                  {en.app.retry}
                </button>
              </StatusAlert>
            </div>
          ) : null}
          {isCreativePurpose(purpose) && creative ? (
            <>
              <OptionGroup
                label={en.screenshots.backgroundLabel}
                hint={en.screenshots.headerBackgroundHint}
                options={backgroundOptions}
                value={[backgroundKey(creative.background)]}
                onSelect={(id) => {
                  const found = backgroundList.find((b) => backgroundKey(b.background) === id);
                  if (found) updateCreative({ ...creative, background: found.background });
                }}
              />
              {/* Phrases only when an image of this purpose draws one (event images have no own text). */}
              {creativeImages.some((image) => image.text) ? (
                <LocaleTextFields
                  heading={en.screenshots.phrasesHeading}
                  locales={editOptions}
                  values={creative.phrases}
                  label={en.screenshots.phraseLabel}
                  hint={en.screenshots.phraseHint(catalogue.maxPhrase)}
                  maxLength={catalogue.maxPhrase}
                  onChange={(locale, text) => updateCreative({ ...creative, phrases: { ...creative.phrases, [locale]: text } })}
                />
              ) : null}
              <p className="max-w-prose text-sm text-base-content/70">{purpose === 'feature' ? en.screenshots.featureUsesShots : en.screenshots.headerUsesShots}</p>
              <SaveStatus state={creativeSaveState} failedText={en.screenshots.saveFailed} />
            </>
          ) : null}
          <div>
            <button type="button" className="btn btn-primary min-h-11" onClick={() => goTo(purpose === 'frame' ? 'export' : 'preview')}>
              {purpose === 'frame' ? en.steps.export : en.steps.preview} →
            </button>
          </div>
        </section>
      ) : null}

      {step === 'preview' && isCreativePurpose(purpose) ? (
        <section aria-labelledby="step-preview" className="flex flex-col gap-4">
          <h2 id="step-preview" tabIndex={-1} className="text-xl font-semibold focus:outline-none">
            {en.steps.preview}
          </h2>
          <LocaleSelector label={en.screenshots.editLocaleLabel} mode="single" options={editOptions} value={[editLocale]} onChange={([id]) => id && setEditLocale(id)} />
          {usesFallback ? <StatusAlert tone="info" title={en.screenshots.fallbackNote(localeName(project.sourceLocale))} /> : null}
          <ToggleField label={purpose === 'header' ? en.screenshots.showSafeArea : en.screenshots.showKeyArea} checked={showSafeArea} onChange={setShowSafeArea} />
          {showSafeArea ? (
            <p className="max-w-prose text-sm text-base-content/70">{purpose === 'header' ? en.screenshots.safeAreaHint : en.screenshots.keyAreaHint}</p>
          ) : null}
          {shownEntries.length === 0 ? (
            <StatusAlert tone="info" title={en.screenshots.headerNeedsShots(localeName(project.sourceLocale))} />
          ) : (
            <ul className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy={Object.keys(creativePreviews).length < creativeImages.length}>
              {creativeImages.map((image) => {
                const preview = creativePreviews[image.specId];
                const key = creativeLabelKey(image.specId);
                const name = key ? en.screenshots.creativeAssets[key] : image.name;
                const loaded = preview && preview !== 'failed' ? preview : null;
                const status: CheckStatus | undefined = preview === undefined ? undefined : preview === 'failed' ? 'error' : preview.warnings.length > 0 ? 'warning' : 'ok';
                const { width, height } = image.size;
                return (
                  <PreviewCard
                    key={image.specId}
                    // A failed preview shows no picture (no endless skeleton); a loading one a skeleton of the real shape.
                    {...(preview === 'failed'
                      ? {}
                      : {
                          media: loaded ? (
                            <img src={loaded.image} alt={en.screenshots.creativePreviewAlt(name, localeName(editLocale))} className="h-auto! w-full rounded object-contain" />
                          ) : (
                            <div className="skeleton w-full" style={{ aspectRatio: `${width} / ${height}` }} aria-hidden="true" />
                          ),
                        })}
                    title={name}
                    size={en.screenshots.creativeSize(width, height, image.safeArea.width, image.safeArea.height, image.storeSafeArea)}
                    {...(status ? { status } : {})}
                    messages={preview === 'failed' ? [en.screenshots.previewFailed] : (loaded?.warnings.map((w) => w.message) ?? [])}
                    {...(loaded && showSafeArea ? { guide: safeAreaPercent(safeAreaShares(image.size, image.safeArea)) } : {})}
                  />
                );
              })}
            </ul>
          )}
          <div>
            <button type="button" className="btn btn-primary min-h-11" onClick={() => goTo('export')}>
              {en.steps.export} →
            </button>
          </div>
        </section>
      ) : null}

      {step === 'preview' && !isCreativePurpose(purpose) && sets ? (
        <section aria-labelledby="step-preview" className="flex flex-col gap-6">
          <h2 id="step-preview" tabIndex={-1} className="text-xl font-semibold focus:outline-none">
            {en.steps.preview}
          </h2>
          <section aria-labelledby="style-heading" className="flex flex-col gap-2">
            <h3 id="style-heading" className="text-lg font-semibold">
              {en.screenshots.styleHeading}
            </h3>
            <OptionGroup
              label={en.screenshots.layoutLabel}
              options={layoutOptions}
              value={[sets.style.layout]}
              onSelect={(layout) => updateSets({ ...sets, style: { ...sets.style, layout: layout as CardLayout } })}
            />
            <OptionGroup
              label={en.screenshots.backgroundLabel}
              hint={en.screenshots.backgroundHint}
              options={backgroundOptions}
              value={[backgroundKey(sets.style.background)]}
              onSelect={(id) => {
                const found = backgroundList.find((b) => backgroundKey(b.background) === id);
                if (found) updateSets({ ...sets, style: { ...sets.style, background: found.background } });
              }}
            />
          </section>

          <section aria-labelledby="slots-heading" className="flex flex-col gap-3">
            <h3 id="slots-heading" tabIndex={-1} className="text-lg font-semibold focus:outline-none">
              {en.screenshots.slotsHeading}
            </h3>
            {editsLocked ? <StatusAlert tone="info" title={en.screenshots.ai.editsPaused} /> : null}
            <LocaleSelector label={en.screenshots.editLocaleLabel} mode="single" options={editOptions} value={[editLocale]} onChange={([id]) => id && setEditLocale(id)} />
            {devices.length > 0 ? (
              <OptionGroup
                label={en.screenshots.deviceLabel}
                options={devices.map((d) => ({ id: d.id, label: d.name, secondary: en.targets[d.target] }))}
                value={[device]}
                onSelect={setDevice}
                {...(device.startsWith('google.') ? { hint: en.screenshots.frameHint } : {})}
              />
            ) : (
              <StatusAlert tone="info" title={en.screenshots.noDevice} />
            )}
            {/* Move / remove are announced here; the autosave state is only shown, not announced on every pause. */}
            <div role="status" className="sr-only">
              {announce}
            </div>
            {deviceSize ? <p className="text-sm text-base-content/70">{`${deviceName} · ${en.screenshots.pixels(deviceSize.width, deviceSize.height)}`}</p> : null}
            <SaveStatus state={saveState} failedText={en.screenshots.saveFailed} conflictText={en.screenshots.changedElsewhere} />
            {usesFallback ? (
              <>
                <StatusAlert tone="info" title={en.screenshots.fallbackNote(localeName(project.sourceLocale))}>
                  <button type="button" className="btn btn-sm min-h-11 mt-2" onClick={() => goTo('upload')}>
                    {en.screenshots.uploadOwn(localeName(editLocale))}
                  </button>
                </StatusAlert>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy={Object.keys(previews).length < shownEntries.length}>
                  {shownEntries.map((entry, index) => {
                    const { media, status, messages } = previewFor(index, en.screenshots.thumbAlt(index + 1, uploadName(entry.input)));
                    return (
                      <PreviewCard
                        key={`${entry.input}-${index}`}
                        media={media}
                        title={`${index + 1}. ${uploadName(entry.input)}`}
                        size={deviceSize ? `${deviceName} · ${en.screenshots.pixels(deviceSize.width, deviceSize.height)}` : deviceName}
                        {...(status ? { status } : {})}
                        messages={messages}
                      />
                    );
                  })}
                </ul>
              </>
            ) : (
              <ol className="flex flex-col gap-3">
                {ownEntries.map((entry, index) => {
                  const values: SlotValues = { headline: entry.headline, subline: entry.subline, ...overrideIds(entry) };
                  const { media, status, messages } = previewFor(index, en.screenshots.thumbAlt(index + 1, uploadName(entry.input)), inputFileUrl(entry.input));
                  return (
                    <SlotEditor
                      key={entry.input}
                      position={index + 1}
                      total={ownEntries.length}
                      media={media}
                      {...(status ? { status } : {})}
                      messages={messages}
                      locale={editLocale}
                      values={values}
                      layoutOptions={[inheritOption, ...layoutOptions]}
                      backgroundOptions={[inheritOption, ...backgroundOptions]}
                      frameOptions={slotFrameOptions}
                      onChange={(patch) => {
                        const { headline, subline, ...overrides } = patch;
                        let next: ScreenshotEntry = { ...entry, ...(headline !== undefined ? { headline } : {}), ...(subline !== undefined ? { subline } : {}) };
                        next = applyOverrides(next, overrides, backgroundList.map((b) => b.background));
                        updateEntries(ownEntries.map((e, i) => (i === index ? next : e)));
                      }}
                      onMove={(direction) => {
                        if (updateEntries(moveEntry(ownEntries, index, direction))) say(en.screenshots.moved(index + 1 + direction, ownEntries.length));
                      }}
                      onRemove={() => {
                        if (!updateEntries(removeEntry(ownEntries, index))) return;
                        say(en.screenshots.removed);
                        // The removed slot took the focus with it: move it to the next slot, or the list heading.
                        requestAnimationFrame(() => {
                          const headings = document.querySelectorAll<HTMLElement>('[data-slot-heading]');
                          (headings[Math.min(index, headings.length - 1)] ?? document.getElementById('slots-heading'))?.focus();
                        });
                      }}
                    />
                  );
                })}
              </ol>
            )}
          </section>
          <AiJobPanel
            job={aiJob}
            text={en.screenshots.ai}
            resultLocales={aiLocales}
            localeName={localeName}
            actions={(['A', 'B'] as const).map((variant) => ({
              id: variant,
              label: en.screenshots.ai.apply(variant),
              confirmTitle: en.screenshots.ai.confirmTitle(variant),
              confirmBody: en.screenshots.ai.confirmBody(aiLocales.map(localeName).join(', ')),
            }))}
            preparing={aiBusy === 'prepare'}
            applying={aiBusy === 'A' || aiBusy === 'B' ? aiBusy : null}
            message={aiMessage}
            onPrepare={() => void prepareAiJob()}
            onApply={(variant) => void applyAiJob(variant === 'B' ? 'B' : 'A')}
          >
            <p className="text-sm text-base-content/70">{en.screenshots.ai.variantHint}</p>
            <div className="grid grid-cols-1 gap-3">
              {aiLocales.map((locale) => (
                <AiResultCard
                  key={locale}
                  locale={locale}
                  localeName={localeName(locale)}
                  rows={(aiJob?.headlines?.locales[locale]?.slots ?? []).map((slot, index) => ({
                    title: `${en.screenshots.ai.slot(index + 1)} · ${uploadName(slot.input)}`,
                    texts: (['A', 'B'] as const).map((variant) => ({
                      label: en.screenshots.ai.variant(variant),
                      main: slot[variant].headline,
                      ...(slot[variant].subline ? { sub: slot[variant].subline } : {}),
                    })),
                  }))}
                />
              ))}
            </div>
          </AiJobPanel>
          <div>
            <button type="button" className="btn btn-primary min-h-11" onClick={() => goTo('export')}>
              {en.steps.export} →
            </button>
          </div>
        </section>
      ) : null}

      {step === 'export' ? (
        <section aria-labelledby="step-export" className="flex flex-col gap-4">
          <h2 id="step-export" tabIndex={-1} className="text-xl font-semibold focus:outline-none">
            {en.screenshots.exportHeading}
          </h2>
          <p className="max-w-prose">{en.screenshots.generateHint}</p>
          <div className="flex flex-wrap items-center gap-3">
            <BusyButton primary busy={generateState !== null} busyLabel={en.screenshots.generatingShort} onClick={() => void generate()}>
              {generateLabel}
            </BusyButton>
            <a href={sectionHref('export')} className="btn min-h-11">
              {en.screenshots.toExport}
            </a>
          </div>
          <div role="status">
            {generateState ? (
              <ProgressStatus label={en.screenshots.generating(generateState.locale, generateState.done, generateState.total)} value={generateState.done} max={generateState.total} />
            ) : null}
            {generateMessage && generateMessage.tone !== 'error' ? (
              <StatusAlert announce={false} tone={generateMessage.tone} title={generateMessage.text}>
                {generateMessage.details && generateMessage.details.length > 0 ? (
                  <ul className="list-disc pl-5 wrap-anywhere">{generateMessage.details.map((d, i) => <li key={i}>{d}</li>)}</ul>
                ) : null}
              </StatusAlert>
            ) : null}
          </div>
          <div role="alert">
            {generateMessage?.tone === 'error' ? (
              <StatusAlert announce={false} tone="error" title={generateMessage.text}>
                {generateMessage.details && generateMessage.details.length > 0 ? <p>{generateMessage.details.join(' ')}</p> : null}
              </StatusAlert>
            ) : null}
          </div>
        </section>
      ) : null}
    </SectionLayout>
  );
}
