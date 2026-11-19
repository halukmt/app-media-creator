import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  fetchBackgrounds,
  fetchInputs,
  fetchScreenshots,
  generateFramedScreenshots,
  generateScreenshotCards,
  inputFileUrl,
  previewCard,
  saveScreenshots,
  uploadScreenshot,
  type BackgroundPreset,
  type Catalogue,
  type CardLayout,
  type CardPreviewResult,
  type ProjectSettings,
  type ScreenshotEntry,
  type ScreenshotSets,
  type StoredInput,
} from '../api';
import { BusyButton } from '../components/BusyButton';
import { FileField } from '../components/FileField';
import { LocaleSelector } from '../components/LocaleSelector';
import { OptionGroup, type Option } from '../components/OptionGroup';
import { PreviewCard } from '../components/PreviewCard';
import { ProgressStatus } from '../components/ProgressStatus';
import { SectionEmptyState } from '../components/SectionEmptyState';
import { SlotEditor, type SlotValues } from '../components/SlotEditor';
import { StatusAlert } from '../components/StatusAlert';
import { ToggleField } from '../components/ToggleField';
import { en } from '../i18n/en';
import { SectionLayout } from '../layouts/SectionLayout';
import type { CheckStatus } from '../lib/export';
import { projectLocaleOptions, sourceLocaleFor } from '../lib/locale-selection';
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
type Purpose = 'cards' | 'frame';
type Message = { tone: 'success' | 'warning' | 'error'; text: string; details?: string[] } | null;

const LAYOUTS: readonly CardLayout[] = ['text-top', 'text-top-large', 'text-bottom'];
const FRAME_KINDS = ['iphone', 'iphone-home', 'iphone-duo', 'ipad', 'android-phone', 'android-tablet'] as const;
const SAVE_DELAY = 600;

function messagesOf(error: unknown): string[] {
  return error instanceof ApiError ? error.messages : [];
}

/** The Screenshots section: upload per language, choose the purpose, edit headlines and style, preview, generate. */
export function ScreenshotsPage({ project, catalogue, selection, onSelectionChange, focusHeading }: Props) {
  const [step, setStep] = useState<StepId>('upload');
  const [purpose, setPurpose] = useState<Purpose>('cards');
  const [inputs, setInputs] = useState<StoredInput[]>([]);
  const [sets, setSets] = useState<ScreenshotSets | null>(null);
  const [backgrounds, setBackgrounds] = useState<{ presets: BackgroundPreset[]; palette: BackgroundPreset[] }>({ presets: [], palette: [] });
  const [editLocale, setEditLocale] = useState(project.sourceLocale);
  const [uploadState, setUploadState] = useState<{ done: number; total: number } | null>(null);
  const [uploadMessage, setUploadMessage] = useState<Message>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [announce, setAnnounce] = useState('');
  const [device, setDevice] = useState<string>('');
  const [previews, setPreviews] = useState<Record<number, CardPreviewResult | 'failed'>>({});
  const [previewVersion, setPreviewVersion] = useState(0);
  const [generateState, setGenerateState] = useState<{ locale: string; done: number; total: number } | null>(null);
  const [generateMessage, setGenerateMessage] = useState<Message>(null);
  const [frameKind, setFrameKind] = useState<string>('iphone');
  const [shadow, setShadow] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localeOptions = projectLocaleOptions(catalogue.locales, project.locales);
  const editOptions = localeOptions.filter((locale) => selection.includes(locale.id));
  const localeName = (id: string) => catalogue.locales.find((locale) => locale.id === id)?.name ?? id;

  // The editing language follows the language bar: when the bar drops it, fall back to the source or first language.
  useEffect(() => {
    setEditLocale((current) => sourceLocaleFor(selection.includes(current) ? current : project.sourceLocale, selection));
  }, [selection, project.sourceLocale]);

  const [loadError, setLoadError] = useState<string[] | null>(null);
  const reload = useCallback(async () => {
    try {
      const [nextInputs, nextSets] = await Promise.all([fetchInputs(), fetchScreenshots()]);
      setInputs(nextInputs.filter((input) => input.kind === 'screenshot'));
      setSets(nextSets);
      setLoadError(null);
    } catch (error) {
      setLoadError(messagesOf(error));
    }
  }, []);

  useEffect(() => {
    void reload();
    fetchBackgrounds()
      .then(setBackgrounds)
      .catch(() => setBackgrounds({ presets: [], palette: [] }));
  }, [reload]);

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

  const ownEntries = sets?.sets[editLocale] ?? [];
  const usesFallback = ownEntries.length === 0 && editLocale !== project.sourceLocale;
  const shownEntries = usesFallback ? (sets?.sets[project.sourceLocale] ?? []) : ownEntries;
  const hasUploads = inputs.length > 0;

  // Edits are saved after a short pause. Saves run one after another; `flushSave` sends a pending edit at once and
  // resolves when everything is stored, so upload, generate and leaving the page never lose or overwrite an edit.
  const queue = useRef(
    createSaveQueue<ScreenshotSets>(saveScreenshots, () => {
      setSaveState('saved');
      setPreviewVersion((v) => v + 1);
    }),
  );
  /** Sends pending edits now; rejects (and keeps them) when the save fails. */
  const flushSave = useCallback(async (): Promise<void> => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      await queue.current.flush();
    } catch (error) {
      setSaveState('failed');
      throw error;
    }
  }, []);

  function updateSets(next: ScreenshotSets) {
    setSets(next);
    queue.current.schedule(next);
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flushSave().catch(() => undefined), SAVE_DELAY);
  }
  // Leaving the section sends a pending edit instead of dropping it.
  useEffect(() => () => void flushSave().catch(() => undefined), [flushSave]);

  function updateEntries(entries: ScreenshotEntry[]) {
    if (!sets) return;
    updateSets({ ...sets, sets: { ...sets.sets, [editLocale]: entries } });
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
        for (const [index, locale] of locales.entries()) {
          setGenerateState({ locale: localeName(locale), done: index, total: locales.length });
          try {
            const result = await generateScreenshotCards([locale]);
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
  const stored = sets ? [sets.style.background, ...Object.values(sets.sets).flatMap((entries) => (entries ?? []).flatMap((e) => (e.background ? [e.background] : [])))] : [];
  const backgroundList = backgroundChoices(offered, stored, en.screenshots.currentBackground);
  const backgroundOptions: Option[] = backgroundList.map((preset) => ({
    id: backgroundKey(preset.background),
    label: preset.name,
    swatch: swatchCss(preset.background),
  }));
  const layoutOptions: Option[] = LAYOUTS.map((layout) => ({ id: layout, label: en.screenshots.layouts[layout] }));
  const inheritOption: Option = { id: INHERIT, label: en.screenshots.inherit };
  const slotFrameOptions: Option[] = [inheritOption, { id: 'device', label: en.screenshots.frameDevice }, { id: 'none', label: en.screenshots.frameNone }];

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
            <button type="button" className="btn btn-sm min-h-11 mt-2" onClick={() => void reload()}>
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
              { id: 'header', label: en.screenshots.purposeHeader, disabled: true, note: en.screenshots.later },
              { id: 'feature', label: en.screenshots.purposeFeature, disabled: true, note: en.screenshots.later },
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
          <div>
            <button type="button" className="btn btn-primary min-h-11" onClick={() => goTo(purpose === 'cards' ? 'preview' : 'export')}>
              {purpose === 'cards' ? en.steps.preview : en.steps.export} →
            </button>
          </div>
        </section>
      ) : null}

      {step === 'preview' && sets ? (
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
            <p className="text-sm text-base-content/70" aria-live="off">
              {saveState === 'saving' ? en.screenshots.saving : saveState === 'saved' ? en.screenshots.saved : ''}
              {deviceSize ? ` ${deviceName} · ${en.screenshots.pixels(deviceSize.width, deviceSize.height)}` : ''}
            </p>
            <div role="alert">{saveState === 'failed' ? <StatusAlert announce={false} tone="error" title={en.screenshots.saveFailed} /> : null}</div>
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
                        updateEntries(moveEntry(ownEntries, index, direction));
                        say(en.screenshots.moved(index + 1 + direction, ownEntries.length));
                      }}
                      onRemove={() => {
                        updateEntries(removeEntry(ownEntries, index));
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
              {purpose === 'frame' ? en.screenshots.generateFramed : en.screenshots.generate}
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
