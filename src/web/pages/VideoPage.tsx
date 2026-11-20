import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchInputs,
  fetchOutputs,
  fetchVideoSettings,
  fetchVideoTools,
  generateVideos,
  messagesOf,
  outputVideoUrl,
  saveVideoSettings,
  uploadVideo,
  type Catalogue,
  type ProjectSettings,
  type StoredInput,
  type VideoSettings,
} from '../api';
import { BusyButton } from '../components/BusyButton';
import { FileField } from '../components/FileField';
import { LocaleSelector } from '../components/LocaleSelector';
import { LocaleTextFields } from '../components/LocaleTextFields';
import { OptionGroup } from '../components/OptionGroup';
import { PreviewCard } from '../components/PreviewCard';
import { ProgressStatus } from '../components/ProgressStatus';
import { SaveStatus } from '../components/SaveStatus';
import { SectionEmptyState } from '../components/SectionEmptyState';
import { StatusAlert } from '../components/StatusAlert';
import { TextField } from '../components/TextField';
import { useAutosave } from '../hooks/useAutosave';
import { useLoadAfterSaves } from '../hooks/useLoadAfterSaves';
import { useOutputStatuses } from '../hooks/useOutputStatuses';
import { en } from '../i18n/en';
import { SectionLayout } from '../layouts/SectionLayout';
import { FRAME_KINDS } from '../lib/frames';
import { projectLocaleOptions, sourceLocaleFor } from '../lib/locale-selection';
import { uploadName } from '../lib/screenshots';
import { sectionHref } from '../lib/sections';
import { VIDEO_FORMATS, VIDEO_PURPOSES, purposeAvailable, resultSpecs, trimFields, trimFrom, type VideoPurpose } from '../lib/video';

interface Props {
  project: ProjectSettings;
  catalogue: Catalogue;
  selection: readonly string[];
  onSelectionChange: (next: string[]) => void;
  focusHeading: boolean;
}

type StepId = 'upload' | 'purpose' | 'preview' | 'export';
type Message = { tone: 'success' | 'warning' | 'error'; text: string; details?: string[] } | null;

const VIDEO_SETTINGS = { section: 'video', document: 'video-settings' } as const;
const CARD_SECONDS = [1, 2, 3, 4, 5] as const;
/** Empty captions: the recordings have no speech, and a captions track keeps the players accessible. */
const NO_SPEECH = 'data:text/vtt;charset=utf-8,WEBVTT%0A';

/**
 * The Video section (#23): upload a screen recording per language, choose what the videos are for (App Store preview,
 * device video, header and search loop), set the options, and make the videos for the selected languages.
 */
export function VideoPage({ project, catalogue, selection, onSelectionChange, focusHeading }: Props) {
  const [step, setStep] = useState<StepId>('upload');
  const [recordings, setRecordings] = useState<StoredInput[]>([]);
  const [loadError, setLoadError] = useState<string[] | null>(null);
  const [tools, setTools] = useState<{ ffmpeg: boolean } | null>(null);
  const [settings, setSettings] = useState<VideoSettings | null>(null);
  const [trim, setTrim] = useState({ start: '', end: '' });
  const [editLocale, setEditLocale] = useState(project.sourceLocale);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<Message>(null);
  const [outputs, setOutputs] = useState<Awaited<ReturnType<typeof fetchOutputs>>>([]);
  const [outputVersion, setOutputVersion] = useState(0);
  const [generateState, setGenerateState] = useState<{ languages: string } | null>(null);
  const [generateMessage, setGenerateMessage] = useState<Message>(null);

  const localeOptions = projectLocaleOptions(catalogue.locales, project.locales);
  const editOptions = localeOptions.filter((locale) => selection.includes(locale.id));
  const localeName = (id: string) => catalogue.locales.find((locale) => locale.id === id)?.name ?? id;

  useEffect(() => {
    setEditLocale((current) => sourceLocaleFor(selection.includes(current) ? current : project.sourceLocale, selection));
  }, [selection, project.sourceLocale]);

  const reload = useCallback(async () => {
    try {
      const [inputs, nextSettings, nextOutputs] = await Promise.all([fetchInputs(), fetchVideoSettings(), fetchOutputs()]);
      setRecordings(inputs.filter((input) => input.kind === 'video'));
      // The settings and the trim fields come from the first load only: later reloads (after an upload) must not
      // overwrite edits that are still waiting to be saved.
      setSettings((current) => {
        if (current) return current;
        setTrim(trimFields(nextSettings.trim));
        return nextSettings;
      });
      setOutputs(nextOutputs);
      setLoadError(null);
    } catch (error) {
      setLoadError(messagesOf(error));
    }
  }, []);
  // A save started when this section was left a moment ago must land first (#98).
  useLoadAfterSaves(reload);
  useEffect(() => {
    fetchVideoTools()
      .then(setTools)
      .catch(() => setTools(null));
  }, []);

  // Settings are saved shortly after each change; generating and leaving the page send pending changes first (#101).
  const { saveState, schedule, flush } = useAutosave<VideoSettings>({ source: VIDEO_SETTINGS, save: saveVideoSettings });
  function update(next: VideoSettings) {
    setSettings(next);
    schedule(next);
  }

  const trimResult = trimFrom(trim, { invalid: en.video.trimInvalid, order: en.video.trimOrder });
  function updateTrim(field: 'start' | 'end', text: string) {
    const next = { ...trim, [field]: text };
    setTrim(next);
    const result = trimFrom(next, { invalid: en.video.trimInvalid, order: en.video.trimOrder });
    if (settings && !result.errors.start && !result.errors.end) update({ ...settings, trim: result.trim });
  }

  const purpose: VideoPurpose = settings?.purpose ?? 'store-preview';
  const statuses = useOutputStatuses(outputs, selection);
  const results = useMemo(
    () => outputs.filter((entry) => resultSpecs(purpose).includes(entry.specId) && (!entry.locale || selection.includes(entry.locale))),
    [outputs, purpose, selection],
  );
  // Recordings that matter for the selected languages: their own, or the source language's they fall back to.
  const shownRecordings = recordings.filter((input) => input.locale && (selection.includes(input.locale) || input.locale === project.sourceLocale));
  const hasRecordings = shownRecordings.length > 0;
  const ownRecordings = recordings.filter((input) => input.locale === editLocale);

  const steps = [
    { id: 'upload', label: en.steps.upload },
    { id: 'purpose', label: en.steps.purpose, disabled: !hasRecordings },
    { id: 'preview', label: en.video.optionsHeading, disabled: !hasRecordings },
    { id: 'export', label: en.steps.export, disabled: !hasRecordings },
  ];

  function goTo(next: StepId) {
    setStep(next);
    requestAnimationFrame(() => document.getElementById(`step-${next}`)?.focus());
  }

  async function upload(files: File[]) {
    const [file] = files;
    if (!file) return;
    setUploadMessage(null);
    setUploading(true);
    try {
      await uploadVideo(file, editLocale);
      setUploadMessage({ tone: 'success', text: en.video.uploaded });
      await reload();
    } catch (error) {
      setUploadMessage({ tone: 'error', text: en.video.uploadFailed(file.name), details: messagesOf(error) });
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    if (!settings) return;
    setGenerateMessage(null);
    if (trimResult.errors.start || trimResult.errors.end) {
      setGenerateMessage({ tone: 'error', text: en.video.fixOptions });
      return;
    }
    try {
      await flush();
    } catch {
      setGenerateMessage({ tone: 'error', text: en.video.saveFirst });
      return;
    }
    const locales = project.locales.filter((locale) => selection.includes(locale));
    try {
      // One request for all languages: the generator encodes a recording only once for languages that share it.
      setGenerateState({ languages: locales.map(localeName).join(', ') });
      const result = await generateVideos(purpose, locales, { ...settings, trim: trimResult.trim });
      const warnings = result.warnings.map((w) => `${w.path}: ${w.message}`);
      const skipped = result.skipped.map(localeName);
      setGenerateMessage({
        tone: warnings.length > 0 || skipped.length > 0 ? 'warning' : 'success',
        text: en.video.generated(result.entries.length),
        details: [...(skipped.length > 0 ? [en.video.skipped(skipped.join(', '))] : []), ...warnings],
      });
    } catch (error) {
      setGenerateMessage({ tone: 'error', text: en.video.generateFailed, details: messagesOf(error) });
    } finally {
      setGenerateState(null);
      setOutputs(await fetchOutputs().catch(() => outputs));
      setOutputVersion((v) => v + 1);
    }
  }

  const video = (specId: string) => catalogue.videos.find((entry) => entry.specId === specId);
  const sizeText = (specId: string) => {
    const entry = video(specId);
    return entry ? en.video.sizeOf(entry.size.width, entry.size.height) : '';
  };
  const iphone = video('apple.preview.iphone');
  const loop = video('apple.creative.header-video');
  const purposeHints: Record<VideoPurpose, string> = {
    'store-preview': en.video.storePreviewHint([sizeText('apple.preview.iphone'), sizeText('apple.preview.ipad')].filter(Boolean).join(' / '), iphone?.minSeconds ?? 0, iphone?.maxSeconds ?? 0),
    'device-video': en.video.deviceVideoHint,
    loop: en.video.loopHint(loop?.minSeconds ?? 0, loop?.maxSeconds ?? 0),
  };
  // Why the Make button is off, shown next to it (L5).
  const blockers = [
    ...(tools && !tools.ffmpeg ? [en.video.noFfmpeg] : []),
    ...(purposeAvailable(purpose, project.targets) ? [] : [purpose === 'device-video' ? en.video.webDisabled : en.video.appleDisabled]),
  ];

  const purposeOptions = [
    ...VIDEO_PURPOSES.map((id) => ({
      id,
      label: en.video.purposes[id],
      description: purposeHints[id],
      ...(purposeAvailable(id, project.targets) ? {} : { disabled: true, note: id === 'device-video' ? en.video.webDisabled : en.video.appleDisabled }),
    })),
    { id: 'promo', label: en.video.purposes.promo, description: en.video.promoHint, disabled: true, note: en.video.comingLater },
  ];

  return (
    <SectionLayout
      section="video"
      focusHeading={focusHeading}
      steps={{ items: steps, current: step, onSelect: (id) => goTo(id as StepId), unavailableHint: en.video.unavailable }}
      localeBar={{ options: localeOptions, selection, onChange: onSelectionChange }}
    >
      <div role="alert" className="flex flex-col gap-2">
        {loadError ? (
          <StatusAlert announce={false} tone="error" title={en.video.loadFailed}>
            {loadError.length > 0 ? <p className="wrap-anywhere">{loadError.join(' ')}</p> : null}
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
          {!hasRecordings ? <SectionEmptyState section="video" project={project} /> : null}
          <LocaleSelector label={en.video.uploadLocaleLabel} mode="single" options={editOptions} value={[editLocale]} onChange={([id]) => id && setEditLocale(id)} />
          <FileField label={en.video.uploadLabel} accept="video/mp4,video/quicktime,.mp4,.mov,.m4v" hint={en.video.uploadHint} onFiles={(files) => void upload(files)} disabled={uploading} />
          <div role="status">
            {uploading ? <ProgressStatus label={en.video.uploading} /> : null}
            {uploadMessage?.tone === 'success' ? <StatusAlert announce={false} tone="success" title={uploadMessage.text} /> : null}
          </div>
          <div role="alert">
            {uploadMessage?.tone === 'error' ? (
              <StatusAlert announce={false} tone="error" title={uploadMessage.text}>
                {uploadMessage.details?.length ? <p className="wrap-anywhere">{uploadMessage.details.join(' ')}</p> : null}
              </StatusAlert>
            ) : null}
          </div>
          {hasRecordings ? (
            <section aria-labelledby="recordings-heading" className="flex flex-col gap-3">
              <h3 id="recordings-heading" className="text-lg font-semibold">
                {en.video.recordingsHeading}
              </h3>
              {ownRecordings.length === 0 && editLocale !== project.sourceLocale ? (
                <StatusAlert tone="info" title={en.video.noRecording(localeName(editLocale), localeName(project.sourceLocale))} />
              ) : null}
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {shownRecordings.map((input) => (
                    // PreviewCard is the list item itself.
                    <PreviewCard key={input.path} title={uploadName(input.path)} size={`${localeName(input.locale ?? '')} · ${Math.round(input.bytes / (1024 * 1024)) || '<1'} MB`} messages={[]} />
                  ))}
              </ul>
              <div>
                <button type="button" className="btn btn-primary min-h-11" onClick={() => goTo('purpose')}>
                  {en.steps.purpose} →
                </button>
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

      {step === 'purpose' && settings ? (
        <section aria-labelledby="step-purpose" className="flex flex-col gap-4">
          <h2 id="step-purpose" tabIndex={-1} className="text-xl font-semibold focus:outline-none">
            {en.steps.purpose}
          </h2>
          <OptionGroup
            label={en.video.purposeLabel}
            variant="card"
            value={[purpose]}
            onSelect={(id) => update({ ...settings, purpose: id as VideoPurpose })}
            options={purposeOptions}
          />
          <SaveStatus state={saveState} failedText={en.video.saveFailed} />
          <div>
            <button type="button" className="btn btn-primary min-h-11" onClick={() => goTo('preview')}>
              {en.video.optionsHeading} →
            </button>
          </div>
        </section>
      ) : null}

      {step === 'preview' && settings ? (
        <section aria-labelledby="step-preview" className="flex max-w-3xl flex-col gap-4">
          <h2 id="step-preview" tabIndex={-1} className="text-xl font-semibold focus:outline-none">
            {en.video.optionsHeading}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label={en.video.trimStart} value={trim.start} inputMode="decimal" hint={en.video.trimHint} onChange={(text) => updateTrim('start', text)} {...(trimResult.errors.start ? { error: trimResult.errors.start } : {})} />
            <TextField label={en.video.trimEnd} value={trim.end} inputMode="decimal" onChange={(text) => updateTrim('end', text)} {...(trimResult.errors.end ? { error: trimResult.errors.end } : {})} />
          </div>
          {purpose === 'store-preview' ? (
            <>
              <LocaleTextFields
                heading={en.video.introHeading}
                locales={editOptions}
                values={settings.intro}
                label={en.video.cardLabel}
                hint={en.video.cardHint(catalogue.maxPhrase)}
                maxLength={catalogue.maxPhrase}
                onChange={(locale, text) => update({ ...settings, intro: { ...settings.intro, [locale]: text } })}
              />
              <LocaleTextFields
                heading={en.video.outroHeading}
                locales={editOptions}
                values={settings.outro}
                label={en.video.cardLabel}
                hint={en.video.cardHint(catalogue.maxPhrase)}
                maxLength={catalogue.maxPhrase}
                onChange={(locale, text) => update({ ...settings, outro: { ...settings.outro, [locale]: text } })}
              />
              <OptionGroup
                label={en.video.cardSecondsLabel}
                options={CARD_SECONDS.map((seconds) => ({ id: String(seconds), label: en.video.cardSeconds(seconds) }))}
                value={[String(settings.cardSeconds)]}
                onSelect={(id) => update({ ...settings, cardSeconds: Number(id) })}
              />
            </>
          ) : null}
          {purpose === 'device-video' ? (
            <>
              <OptionGroup
                label={en.video.formatsLabel}
                multiple
                options={VIDEO_FORMATS.map((format) => ({ id: format, label: en.video.formats[format] }))}
                value={settings.formats}
                onSelect={(id) => {
                  const has = settings.formats.includes(id as (typeof VIDEO_FORMATS)[number]);
                  const formats = has ? settings.formats.filter((format) => format !== id) : [...settings.formats, id as (typeof VIDEO_FORMATS)[number]];
                  // At least one format stays chosen.
                  if (formats.length > 0) update({ ...settings, formats: VIDEO_FORMATS.filter((format) => formats.includes(format)) });
                }}
              />
              <OptionGroup
                label={en.video.frameLabel}
                options={[...FRAME_KINDS.map((kind) => ({ id: kind, label: en.screenshots.frames[kind] })), { id: 'none', label: en.video.frameNone }]}
                value={[settings.frame]}
                onSelect={(id) => update({ ...settings, frame: id })}
              />
              <LocaleTextFields
                heading={en.video.textsHeading}
                locales={editOptions}
                values={settings.texts}
                label={en.video.textLabel}
                hint={en.video.textHint(catalogue.maxPhrase)}
                maxLength={catalogue.maxPhrase}
                onChange={(locale, text) => update({ ...settings, texts: { ...settings.texts, [locale]: text } })}
              />
            </>
          ) : null}
          {purpose === 'loop' ? (
            <StatusAlert tone="info" title={en.video.loopNote}>
              <a href={sectionHref('screenshots')} className="btn btn-sm min-h-11 mt-2">
                {en.video.toScreenshots}
              </a>
            </StatusAlert>
          ) : null}
          <SaveStatus state={saveState} failedText={en.video.saveFailed} />
          <div>
            <button type="button" className="btn btn-primary min-h-11" onClick={() => goTo('export')}>
              {en.steps.export} →
            </button>
          </div>
        </section>
      ) : null}

      {step === 'export' && settings ? (
        <section aria-labelledby="step-export" className="flex flex-col gap-4">
          <h2 id="step-export" tabIndex={-1} className="text-xl font-semibold focus:outline-none">
            {en.video.exportHeading}
          </h2>
          <p className="max-w-prose">{en.video.generateHint}</p>
          {blockers.length > 0 ? (
            <StatusAlert announce={false} tone="warning" title={en.video.cannotMake}>
              <ul className="list-disc pl-5">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
              {purposeAvailable(purpose, project.targets) ? null : (
                <a href={sectionHref('project')} className="btn btn-sm min-h-11 mt-2">
                  {en.empty.toProject}
                </a>
              )}
            </StatusAlert>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <BusyButton primary busy={generateState !== null} busyLabel={en.video.generatingShort} disabled={blockers.length > 0} onClick={() => void generate()}>
              {en.video.generate[purpose]}
            </BusyButton>
            <a href={sectionHref('export')} className="btn min-h-11">
              {en.video.toExport}
            </a>
          </div>
          <div role="status">
            {generateState ? <ProgressStatus label={en.video.generating(generateState.languages)} /> : null}
            {generateMessage && generateMessage.tone !== 'error' ? (
              <StatusAlert announce={false} tone={generateMessage.tone} title={generateMessage.text}>
                {generateMessage.details && generateMessage.details.length > 0 ? (
                  <ul className="list-disc pl-5 wrap-anywhere">
                    {generateMessage.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                ) : null}
              </StatusAlert>
            ) : null}
          </div>
          <div role="alert">
            {generateMessage?.tone === 'error' ? (
              <StatusAlert announce={false} tone="error" title={generateMessage.text}>
                {generateMessage.details?.length ? <p className="wrap-anywhere">{generateMessage.details.join(' ')}</p> : null}
              </StatusAlert>
            ) : null}
          </div>
          <section aria-labelledby="results-heading" className="flex flex-col gap-3">
            <h3 id="results-heading" className="text-lg font-semibold">
              {en.video.resultsHeading}
            </h3>
            {purpose === 'store-preview' && results.length > 0 ? <p className="max-w-prose text-sm text-base-content/70">{en.video.posterNote}</p> : null}
            {results.length === 0 ? <p className="text-base-content/70">{en.video.noResults}</p> : null}
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((entry) => {
                const name = en.video.specNames[entry.specId] ?? entry.specId;
                const language = entry.locale ? localeName(entry.locale) : '';
                const status = statuses.get(entry.path);
                return (
                  <PreviewCard
                    key={entry.path}
                    title={name}
                    size={en.video.resultSize(language, sizeText(entry.specId))}
                    messages={status?.messages ?? []}
                    {...(status ? { status: status.status } : {})}
                    media={
                      // #t=1: the first frame is black (fade in); the height keeps name and badge in view on a phone.
                      <video controls preload="metadata" className="mx-auto max-h-[60svh] w-auto max-w-full rounded" src={`${outputVideoUrl(entry.path, outputVersion)}#t=1`} aria-label={en.video.videoLabel(name, language)}>
                        <track kind="captions" src={NO_SPEECH} srcLang="en" label={en.video.noSpeech} />
                      </video>
                    }
                  />
                );
              })}
            </ul>
          </section>
        </section>
      ) : null}
    </SectionLayout>
  );
}
