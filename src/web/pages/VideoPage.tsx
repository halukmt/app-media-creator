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
import { AiJobPanel, type AiJobMessage } from '../components/AiJobPanel';
import { AiResultCard } from '../components/AiResultCard';
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
import { anyUnverified } from '../lib/logo';
import { TextField } from '../components/TextField';
import { useAutosave } from '../hooks/useAutosave';
import { useLoadAfterSaves } from '../hooks/useLoadAfterSaves';
import { useOutputStatuses } from '../hooks/useOutputStatuses';
import { usePromoJob } from '../hooks/usePromoJob';
import { en } from '../i18n/en';
import { SectionLayout } from '../layouts/SectionLayout';
import { FRAME_KINDS } from '../lib/frames';
import { projectLocaleOptions, sourceLocaleFor } from '../lib/locale-selection';
import { uploadName } from '../lib/screenshots';
import { sectionHref } from '../lib/sections';
import {
  VIDEO_FORMATS,
  VIDEO_PURPOSES,
  isWebUrlOrEmpty,
  needsRecording,
  promoLocales,
  purposeAvailable,
  resultSpecs,
  toggleFormat,
  trimFields,
  trimFrom,
  type VideoPurpose,
} from '../lib/video';

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
 * device video, header and search loop, promo reel), set the options, and make the videos for the selected languages.
 * Promo reels (#22) are rendered by Claude Code (amc-video with brag) from an AI job and need no recording.
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
  // Pixel size per generated video, read from the player once its metadata has loaded.
  const [videoSizes, setVideoSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [generateState, setGenerateState] = useState<{ languages: string } | null>(null);
  const [generateMessage, setGenerateMessage] = useState<Message>(null);
  // The promo source fields as typed; only valid addresses are saved (#22).
  const [promoUrls, setPromoUrls] = useState({ website: '', repo: '' });

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
        setPromoUrls({ website: nextSettings.promo.website ?? '', repo: nextSettings.promo.repo ?? '' });
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

  const promoJob = usePromoJob(async () => {
    // A failed reload keeps the outputs shown now.
    const next = await fetchOutputs().catch(() => null);
    if (next) setOutputs(next);
    setOutputVersion((v) => v + 1);
  });

  function updatePromoUrl(field: 'website' | 'repo', text: string) {
    setPromoUrls((current) => ({ ...current, [field]: text }));
    if (!settings || !isWebUrlOrEmpty(text)) return;
    const { [field]: _old, ...rest } = settings.promo;
    update({ ...settings, promo: { ...rest, ...(text.trim() ? { [field]: text.trim() } : {}) } });
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
  const promoPossible = purposeAvailable('promo', project.targets);
  // Options and Export need a recording, except for promo reels (#22).
  const canContinue = hasRecordings || (purpose === 'promo' && promoPossible);

  const steps = [
    { id: 'upload', label: en.steps.upload },
    { id: 'purpose', label: en.steps.purpose, disabled: !hasRecordings && !promoPossible },
    { id: 'preview', label: en.video.optionsHeading, disabled: !canContinue },
    { id: 'export', label: en.steps.export, disabled: !canContinue },
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
    if (!settings || purpose === 'promo') return;
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
    promo: en.video.promoHint,
  };
  const unavailableNote = (id: VideoPurpose) => (id === 'promo' ? en.video.promoDisabled : id === 'device-video' ? en.video.webDisabled : en.video.appleDisabled);
  // Why the Make button is off, shown next to it (L5).

  const purposeOptions = VIDEO_PURPOSES.map((id) => ({
    id,
    label: en.video.purposes[id],
    description: purposeHints[id],
    ...(!purposeAvailable(id, project.targets)
      ? { disabled: true, note: unavailableNote(id) }
      : needsRecording(id) && !hasRecordings
        ? { disabled: true, note: en.video.needsRecording }
        : {}),
  }));

  // The promo job panel: its last outcome as a message, and the languages of its checked reels.
  const promoMessage: AiJobMessage | null = promoJob.outcome
    ? {
        action: promoJob.outcome.action,
        tone: 'error',
        text: promoJob.outcome.result === 'saveFirst' ? en.video.saveFirst : promoJob.outcome.action === 'prepare' ? en.video.promo.prepareFailed : en.video.promo.applyFailed,
        ...(promoJob.outcome.details ? { details: promoJob.outcome.details } : {}),
      }
    : null;
  const promoJobLocales = promoLocales(promoJob.job?.promoVideos, project.locales);
  const selectedLocales = project.locales.filter((locale) => selection.includes(locale));
  const promoUrlsValid = isWebUrlOrEmpty(promoUrls.website) && isWebUrlOrEmpty(promoUrls.repo);
  // Why Make (or Prepare, for promo reels) is off, shown next to it (L5).
  const blockers = [
    ...(tools && !tools.ffmpeg ? [en.video.noFfmpeg] : []),
    ...(purposeAvailable(purpose, project.targets) ? [] : [unavailableNote(purpose)]),
    ...(purpose === 'promo' && !promoUrlsValid ? [en.video.promoUrlsInvalid] : []),
    ...(purpose === 'promo' && selectedLocales.length === 0 ? [en.video.promoNoLanguage] : []),
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
          {!hasRecordings && promoPossible && settings ? (
            <div>
              <button
                type="button"
                className="btn min-h-11"
                onClick={() => {
                  update({ ...settings, purpose: 'promo' });
                  goTo('preview');
                }}
              >
                {en.video.promoWithoutRecording} →
              </button>
            </div>
          ) : null}
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
          {purpose !== 'promo' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label={en.video.trimStart} value={trim.start} inputMode="decimal" hint={en.video.trimHint} onChange={(text) => updateTrim('start', text)} {...(trimResult.errors.start ? { error: trimResult.errors.start } : {})} />
              <TextField label={en.video.trimEnd} value={trim.end} inputMode="decimal" onChange={(text) => updateTrim('end', text)} {...(trimResult.errors.end ? { error: trimResult.errors.end } : {})} />
            </div>
          ) : null}
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
                  // At least one format stays chosen.
                  const formats = toggleFormat(settings.formats, id);
                  if (formats) update({ ...settings, formats });
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
          {purpose === 'promo' ? (
            <>
              {project.targets.web.enabled ? (
                <OptionGroup
                  label={en.video.promoFormatsLabel}
                  multiple
                  options={VIDEO_FORMATS.map((format) => ({ id: format, label: en.video.formats[format] }))}
                  value={settings.promo.formats}
                  onSelect={(id) => {
                    const formats = toggleFormat(settings.promo.formats, id);
                    if (formats) update({ ...settings, promo: { ...settings.promo, formats } });
                  }}
                />
              ) : (
                // Google Play alone takes only the 16:9 reel (for YouTube).
                <StatusAlert tone="info" title={en.video.promoPlayOnly} />
              )}
              <TextField
                label={en.video.promoWebsite}
                value={promoUrls.website}
                inputMode="url"
                hint={en.video.promoSourceHint}
                onChange={(text) => updatePromoUrl('website', text)}
                {...(isWebUrlOrEmpty(promoUrls.website) ? {} : { error: en.video.urlInvalid })}
              />
              <TextField
                label={en.video.promoRepo}
                value={promoUrls.repo}
                inputMode="url"
                onChange={(text) => updatePromoUrl('repo', text)}
                {...(isWebUrlOrEmpty(promoUrls.repo) ? {} : { error: en.video.urlInvalid })}
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
          {purpose !== 'promo' ? <p className="max-w-prose">{en.video.generateHint}</p> : null}
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
          {purpose === 'promo' ? (
            <>
              {project.targets.google.enabled ? <StatusAlert announce={false} tone="info" title={en.video.youtubeNote} /> : null}
              <AiJobPanel
                job={promoJob.job}
                text={en.video.promo}
                resultLocales={promoJobLocales}
                localeName={localeName}
                actions={[
                  {
                    id: 'apply',
                    label: en.video.promo.apply,
                    confirmTitle: en.video.promo.confirmTitle,
                    confirmBody: en.video.promo.confirmBody(promoJobLocales.map(localeName).join(', ')),
                  },
                ]}
                preparing={promoJob.busy === 'prepare'}
                prepareDisabled={blockers.length > 0}
                applying={promoJob.busy === 'apply' ? 'apply' : null}
                message={promoMessage}
                onPrepare={() =>
                  void promoJob.prepare(
                    selectedLocales,
                    { formats: project.targets.web.enabled ? settings.promo.formats : ['landscape'], ...(settings.promo.website ? { website: settings.promo.website } : {}), ...(settings.promo.repo ? { repo: settings.promo.repo } : {}) },
                    flush,
                  )
                }
                onApply={() => void promoJob.apply()}
              >
                <p className="text-sm text-base-content/70">{en.video.promo.previewHint}</p>
                <div className="grid grid-cols-1 gap-3">
                  {promoJobLocales.map((locale) => (
                    <AiResultCard
                      key={locale}
                      locale={locale}
                      localeName={localeName(locale)}
                      rows={(promoJob.job?.promoVideos ?? [])
                        .filter((reel) => reel.locale === locale)
                        .map((reel) => ({
                          title: en.video.formats[reel.format],
                          texts: [{ main: en.video.promoRow(reel.width, reel.height, Math.round(reel.durationSeconds), (reel.bytes / (1024 * 1024)).toFixed(1)) }],
                        }))}
                    />
                  ))}
                </div>
              </AiJobPanel>
              <div>
                <a href={sectionHref('export')} className="btn min-h-11">
                  {en.video.toExport}
                </a>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <BusyButton primary busy={generateState !== null} busyLabel={en.video.generatingShort} disabled={blockers.length > 0} onClick={() => void generate()}>
                {en.video.generate[purpose]}
              </BusyButton>
              <a href={sectionHref('export')} className="btn min-h-11">
                {en.video.toExport}
              </a>
            </div>
          )}
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
            {/* Said once above the videos, not on every card (#64). */}
            {anyUnverified(results, statuses) ? <p className="max-w-prose text-sm text-base-content/70">{en.video.unverifiedNote}</p> : null}
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((entry) => {
                const name = en.video.specNames[entry.specId] ?? entry.specId;
                const language = entry.locale ? localeName(entry.locale) : '';
                const status = statuses.get(entry.path);
                // The size of the file itself: a landscape recording gives a landscape preview (#111).
                const measured = videoSizes[entry.path];
                return (
                  <PreviewCard
                    key={entry.path}
                    title={name}
                    size={measured ? en.video.resultSize(language, en.video.sizeOf(measured.width, measured.height)) : language}
                    messages={status?.messages ?? []}
                    {...(status ? { status: status.status } : {})}
                    media={
                      // #t=1: the first frame is black (fade in); the height keeps name and badge in view on a phone.
                      <video
                        controls
                        preload="metadata"
                        className="mx-auto max-h-[60svh] w-auto max-w-full rounded"
                        src={`${outputVideoUrl(entry.path, outputVersion)}#t=1`}
                        aria-label={en.video.videoLabel(name, language)}
                        onLoadedMetadata={(event) => {
                          const { videoWidth: width, videoHeight: height } = event.currentTarget;
                          setVideoSizes((current) => (current[entry.path]?.width === width && current[entry.path]?.height === height ? current : { ...current, [entry.path]: { width, height } }));
                        }}
                      >
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
