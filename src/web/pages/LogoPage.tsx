import { useCallback, useState } from 'react';
import {
  fetchBackgrounds,
  fetchInputs,
  fetchLogoOutputs,
  fetchLogoSettings,
  generateLogoPack,
  logoPreviewUrl,
  messagesOf,
  outputFileUrl,
  saveLogoSettings,
  uploadLogo,
  type BackgroundPreset,
  type Catalogue,
  type LogoOutput,
  type LogoPack,
  type LogoSettings,
  type ProjectSettings,
} from '../api';
import { BusyButton } from '../components/BusyButton';
import { FileField } from '../components/FileField';
import { OptionGroup, type Option } from '../components/OptionGroup';
import { PreviewCard } from '../components/PreviewCard';
import { ProgressStatus } from '../components/ProgressStatus';
import { SectionEmptyState } from '../components/SectionEmptyState';
import { SaveStatus } from '../components/SaveStatus';
import { StatusAlert } from '../components/StatusAlert';
import { LocaleTextFields } from '../components/LocaleTextFields';
import { useAutosave } from '../hooks/useAutosave';
import { useLoadAfterSaves } from '../hooks/useLoadAfterSaves';
import { useOutputStatuses } from '../hooks/useOutputStatuses';
import { en } from '../i18n/en';
import { SectionLayout } from '../layouts/SectionLayout';
import { projectLocaleOptions } from '../lib/locale-selection';
import { groupOutputs, groupStatus, MAX_TAGLINE } from '../lib/logo';
import { backgroundChoices, backgroundKey, swatchCss } from '../lib/screenshots';
import { sectionHref, type TargetId } from '../lib/sections';

interface Props {
  project: ProjectSettings;
  catalogue: Catalogue;
  selection: readonly string[];
  onSelectionChange: (next: string[]) => void;
  focusHeading: boolean;
}

type StepId = 'upload' | 'options' | 'preview' | 'export';
type Message = { tone: 'success' | 'warning' | 'error'; text: string; details?: string[] } | null;

const PACKS: readonly LogoPack[] = ['app-store', 'google-play', 'web', 'social'];
const PACK_TARGET: Record<LogoPack, TargetId> = { 'app-store': 'apple', 'google-play': 'google', web: 'web', social: 'web' };
const PREVIEW_WIDTH = 240;
/** Id of the production icon set in the icon set filter (environment ids never equal it). */
const PRODUCTION = 'production';
/** The logo settings as the pending-saves tracker names them (#98). */
const LOGO_SETTINGS = { section: 'logo', document: 'logo-settings' } as const;

/** The Logo section: upload the logo, choose packs, background and taglines, generate everything, preview, export. */
export function LogoPage({ project, catalogue, selection, onSelectionChange, focusHeading }: Props) {
  const [step, setStep] = useState<StepId>('upload');
  const [hasLogo, setHasLogo] = useState(false);
  const [logoVersion, setLogoVersion] = useState(0);
  const [settings, setSettings] = useState<LogoSettings | null>(null);
  const [backgrounds, setBackgrounds] = useState<BackgroundPreset[]>([]);
  const [loadError, setLoadError] = useState<string[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<Message>(null);
  const [outputs, setOutputs] = useState<LogoOutput[]>([]);
  const [outputVersion, setOutputVersion] = useState(0);
  const [generateState, setGenerateState] = useState<{ pack: string; done: number; total: number } | null>(null);
  const [generateMessage, setGenerateMessage] = useState<Message>(null);
  const [iconSet, setIconSet] = useState(PRODUCTION);

  const localeOptions = projectLocaleOptions(catalogue.locales, project.locales);
  const localeName = (id: string) => catalogue.locales.find((locale) => locale.id === id)?.name ?? id;

  // Settings are read only on the first load: later reloads (after an upload) must not overwrite unsaved edits.
  const reload = useCallback(async (withSettings = true) => {
    try {
      const [inputs, nextSettings, nextBackgrounds, nextOutputs] = await Promise.all([
        fetchInputs(),
        fetchLogoSettings(),
        fetchBackgrounds(),
        fetchLogoOutputs(),
      ]);
      setHasLogo(inputs.some((input) => input.kind === 'logo'));
      if (withSettings) setSettings(nextSettings);
      // Icons need one solid colour: gradients are not offered here.
      setBackgrounds([...nextBackgrounds.presets, ...nextBackgrounds.palette].filter((b) => b.background.kind === 'solid'));
      setOutputs(nextOutputs);
      setLoadError(null);
    } catch (error) {
      setLoadError(messagesOf(error));
    }
  }, []);
  // A save started when this section was left a moment ago must land first (#98).
  useLoadAfterSaves(reload);

  // Validation state per generated file, from the export checklist of the selected languages.
  const statuses = useOutputStatuses(outputs, selection);

  // Settings are saved shortly after each change; generate and leaving the page send pending changes first (#101).
  const { saveState, schedule, flush: flushSave } = useAutosave<LogoSettings>({ source: LOGO_SETTINGS, save: saveLogoSettings });

  function update(next: LogoSettings) {
    setSettings(next);
    schedule(next);
  }

  async function upload(files: File[]) {
    const [file] = files;
    if (!file) return;
    setUploadMessage(null);
    setUploading(true);
    try {
      await uploadLogo(file);
      setUploadMessage({ tone: 'success', text: en.logo.uploaded });
      setLogoVersion((v) => v + 1);
      await reload(false);
    } catch (error) {
      setUploadMessage({ tone: 'error', text: en.logo.uploadFailed, details: messagesOf(error) });
    } finally {
      setUploading(false);
    }
  }

  const enabledPacks = PACKS.filter((pack) => project.targets[PACK_TARGET[pack]].enabled);
  const chosen = settings ? settings.packs.filter((pack) => enabledPacks.includes(pack)) : [];

  async function generate() {
    setGenerateMessage(null);
    try {
      await flushSave();
    } catch {
      setGenerateMessage({ tone: 'error', text: en.logo.saveFirst });
      return;
    }
    let files = 0;
    const details: string[] = [];
    let failed = false;
    // One pack after the other: real progress, and a failed pack does not stop the others.
    for (const [index, pack] of chosen.entries()) {
      setGenerateState({ pack: en.logo.packs[pack], done: index, total: chosen.length });
      if (pack === 'social' && selection.length === 0) {
        failed = true;
        details.push(`${en.logo.packFailed(en.logo.packs[pack])} ${en.logo.noLanguage}`);
        continue;
      }
      try {
        const result = await generateLogoPack(pack, selection);
        files += result.entries.length;
        details.push(...result.warnings.map((w) => `${w.path}: ${w.message}`));
      } catch (error) {
        failed = true;
        details.push(`${en.logo.packFailed(en.logo.packs[pack])} ${messagesOf(error).join(' ')}`.trim());
      }
    }
    setGenerateState(null);
    setGenerateMessage({
      tone: failed ? (files > 0 ? 'warning' : 'error') : details.length > 0 ? 'warning' : 'success',
      text: failed && files === 0 ? en.logo.generateFailed : en.logo.generated(files),
      details,
    });
    setOutputs(await fetchLogoOutputs().catch(() => outputs));
    setOutputVersion((v) => v + 1);
  }

  const backgroundList = backgroundChoices(backgrounds, settings ? [{ kind: 'solid' as const, color: settings.background }] : [], en.logo.currentBackground);
  const backgroundOptions: Option[] = backgroundList.map((b) => ({ id: backgroundKey(b.background), label: b.name, swatch: swatchCss(b.background) }));

  const steps = [
    { id: 'upload', label: en.steps.upload },
    { id: 'options', label: en.logo.optionsStep, disabled: !hasLogo },
    { id: 'preview', label: en.logo.previewHeading, disabled: !hasLogo },
    { id: 'export', label: en.steps.export, disabled: !hasLogo },
  ];

  function goTo(next: StepId) {
    setStep(next);
    requestAnimationFrame(() => document.getElementById(`logo-step-${next}`)?.focus());
  }

  // Icon sets: production and every environment that has files, in project order. One set is shown at a time, so the
  // grid does not grow with every environment.
  const environmentIds = [
    ...project.environments.map((e) => e.id).filter((id) => outputs.some((o) => o.environment === id)),
    ...[...new Set(outputs.flatMap((o) => (o.environment ? [o.environment] : [])))].filter((id) => !project.environments.some((e) => e.id === id)),
  ];
  const shownSet = environmentIds.includes(iconSet) ? iconSet : PRODUCTION;
  const iconSetOptions: Option[] = [
    { id: PRODUCTION, label: en.logo.iconSetProduction },
    ...environmentIds.map((id) => ({ id, label: project.environments.find((e) => e.id === id)?.badge ?? id })),
  ];
  const shownOutputs = outputs.filter(
    (o) => (o.locale === undefined || selection.includes(o.locale)) && (o.environment ?? PRODUCTION) === shownSet,
  );

  return (
    <SectionLayout
      section="logo"
      focusHeading={focusHeading}
      steps={{ items: steps, current: step, onSelect: (id) => goTo(id as StepId), unavailableHint: en.logo.unavailable }}
      localeBar={{ options: localeOptions, selection, onChange: onSelectionChange, hint: en.logo.localeHint }}
    >
      <div role="alert">
        {loadError ? (
          <StatusAlert announce={false} tone="error" title={en.logo.loadFailed}>
            {loadError.length > 0 ? <p>{loadError.join(' ')}</p> : null}
            <button type="button" className="btn btn-sm min-h-11 mt-2" onClick={() => void reload()}>
              {en.app.retry}
            </button>
          </StatusAlert>
        ) : null}
      </div>

      {step === 'upload' ? (
        <section aria-labelledby="logo-step-upload" className="flex flex-col gap-4">
          <h2 id="logo-step-upload" tabIndex={-1} className="text-xl font-semibold focus:outline-none">
            {en.steps.upload}
          </h2>
          {!hasLogo ? <SectionEmptyState section="logo" project={project} /> : null}
          {hasLogo ? (
            <ul className="grid max-w-xs grid-cols-1">
              <PreviewCard
                media={<img src={logoPreviewUrl(logoVersion)} alt={en.logo.thumbAlt} className="h-auto! w-full rounded object-contain" />}
                title={en.logo.currentLogo}
                messages={[]}
              />
            </ul>
          ) : null}
          <FileField
            label={en.logo.uploadLabel}
            accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
            hint={en.logo.uploadHint}
            onFiles={(files) => void upload(files)}
            disabled={uploading}
          />
          <div role="status">
            {uploading ? <ProgressStatus label={en.logo.uploading} /> : null}
            {uploadMessage?.tone === 'success' ? <StatusAlert announce={false} tone="success" title={uploadMessage.text} /> : null}
          </div>
          <div role="alert">
            {uploadMessage?.tone === 'error' ? (
              <StatusAlert announce={false} tone="error" title={uploadMessage.text}>
                {uploadMessage.details && uploadMessage.details.length > 0 ? <p>{uploadMessage.details.join(' ')}</p> : null}
              </StatusAlert>
            ) : null}
          </div>
          {hasLogo ? (
            <div>
              <button type="button" className="btn btn-primary min-h-11" onClick={() => goTo('options')}>
                {en.logo.optionsStep} →
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 'options' && settings ? (
        <section aria-labelledby="logo-step-options" className="flex flex-col gap-4">
          <h2 id="logo-step-options" tabIndex={-1} className="text-xl font-semibold focus:outline-none">
            {en.logo.optionsStep}
          </h2>
          <OptionGroup
            label={en.logo.packsLabel}
            multiple
            variant="card"
            value={settings.packs}
            onSelect={(id) => {
              const pack = id as LogoPack;
              const packs = settings.packs.includes(pack) ? settings.packs.filter((p) => p !== pack) : PACKS.filter((p) => p === pack || settings.packs.includes(p));
              update({ ...settings, packs });
            }}
            options={PACKS.map((pack) => ({
              id: pack,
              label: en.logo.packs[pack],
              description: en.logo.packHints[pack],
              ...(enabledPacks.includes(pack) ? {} : { disabled: true, note: en.logo.targetOff }),
            }))}
            {...(chosen.length === 0 ? { error: en.logo.noPacks } : {})}
          />
          <OptionGroup
            label={en.logo.backgroundLabel}
            hint={en.logo.backgroundHint}
            options={backgroundOptions}
            value={[backgroundKey({ kind: 'solid', color: settings.background })]}
            onSelect={(id) => {
              const found = backgroundList.find((b) => backgroundKey(b.background) === id);
              if (found && found.background.kind === 'solid') update({ ...settings, background: found.background.color });
            }}
          />
          {chosen.includes('social') ? (
            <LocaleTextFields
              heading={en.logo.taglinesHeading}
              locales={localeOptions.filter((locale) => selection.includes(locale.id))}
              values={settings.taglines}
              label={en.logo.taglineLabel}
              hint={en.logo.taglineHint(MAX_TAGLINE)}
              maxLength={MAX_TAGLINE}
              onChange={(locale, text) => update({ ...settings, taglines: { ...settings.taglines, [locale]: text } })}
            />
          ) : null}
          <SaveStatus state={saveState} failedText={en.logo.saveFailed} />
          <div>
            <button type="button" className="btn btn-primary min-h-11" onClick={() => goTo('preview')}>
              {en.logo.previewHeading} →
            </button>
          </div>
        </section>
      ) : null}

      {step === 'preview' ? (
        <section aria-labelledby="logo-step-preview" className="flex flex-col gap-4">
          <h2 id="logo-step-preview" tabIndex={-1} className="text-xl font-semibold focus:outline-none">
            {en.logo.previewHeading}
          </h2>
          <div>
            <BusyButton primary={shownOutputs.length === 0} busy={generateState !== null} busyLabel={en.logo.generatingShort} disabled={chosen.length === 0} onClick={() => void generate()}>
              {en.logo.generate}
            </BusyButton>
          </div>
          {chosen.length === 0 ? (
            <StatusAlert tone="warning" title={en.logo.noPacks}>
              <button type="button" className="btn btn-sm min-h-11 mt-2" onClick={() => goTo('options')}>
                {en.logo.optionsStep}
              </button>
            </StatusAlert>
          ) : null}
          <div role="status">
            {generateState ? (
              <ProgressStatus label={en.logo.generating(generateState.pack, generateState.done, generateState.total)} value={generateState.done} max={generateState.total} />
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
          {environmentIds.length > 0 ? (
            <OptionGroup label={en.logo.iconSetLabel} hint={en.logo.iconSetHint} options={iconSetOptions} value={[shownSet]} onSelect={setIconSet} />
          ) : null}
          {shownOutputs.length === 0 ? <p>{en.logo.nothingYet}</p> : null}
          {chosen.map((pack) => {
            const files = shownOutputs.filter((o) => o.pack === pack);
            if (files.length === 0) return null;
            // One card per asset and language (densities and sizes of one asset together); documents come last.
            return (
              <section key={pack} aria-labelledby={`logo-pack-${pack}`} className="flex flex-col gap-2">
                <h3 id={`logo-pack-${pack}`} className="text-lg font-semibold">
                  {en.logo.packs[pack]}
                </h3>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy={generateState !== null}>
                  {groupOutputs(files).map((group) => {
                    const checked = groupStatus(group.files, statuses);
                    const first = group.files[0]!;
                    const size = group.largest
                      ? group.files.length > 1 && group.widths
                        ? en.logo.sizes(group.files.length, group.widths[0], group.widths[1])
                        : en.screenshots.pixels(group.largest.width ?? 0, group.largest.height ?? 0)
                      : first.path.split('/').pop() === group.name
                        ? en.logo.document
                        : `${first.path.split('/').pop() ?? first.path} · ${en.logo.document}`;
                    return (
                      <PreviewCard
                        key={group.key}
                        checkered
                        {...(group.largest
                          ? { media: <img src={outputFileUrl(group.largest.path, PREVIEW_WIDTH, outputVersion)} alt={en.logo.previewAlt(group.environment ? `${group.name} (${group.environment})` : group.name)} className="h-auto! w-full rounded object-contain" /> }
                          : {})}
                        title={
                          group.locale
                            ? `${group.name} · ${localeName(group.locale)}`
                            : group.environment
                              ? `${group.name} · ${en.export.environment(group.environment)}`
                              : group.name
                        }
                        size={size}
                        {...(checked ? { status: checked.status } : {})}
                        messages={checked?.messages ?? []}
                      />
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <div>
            <button type="button" className={`btn min-h-11 ${shownOutputs.length > 0 ? 'btn-primary' : ''}`} onClick={() => goTo('export')}>
              {en.steps.export} →
            </button>
          </div>
        </section>
      ) : null}

      {step === 'export' ? (
        <section aria-labelledby="logo-step-export" className="flex flex-col gap-4">
          <h2 id="logo-step-export" tabIndex={-1} className="text-xl font-semibold focus:outline-none">
            {en.logo.exportHeading}
          </h2>
          <p className="max-w-prose">{en.logo.exportHint}</p>
          <div>
            <a href={sectionHref('export')} className="btn btn-primary min-h-11">
              {en.logo.toExport}
            </a>
          </div>
        </section>
      ) : null}
    </SectionLayout>
  );
}
