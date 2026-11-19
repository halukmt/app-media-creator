import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError, saveProject, type Catalogue, type Environment, type ProjectSettings, type TargetSettings } from '../api';
import { BusyButton } from '../components/BusyButton';
import { EnvironmentCard } from '../components/EnvironmentCard';
import { LocaleSelector } from '../components/LocaleSelector';
import type { Option } from '../components/OptionGroup';
import { PageHeader } from '../components/PageHeader';
import { StatusAlert } from '../components/StatusAlert';
import { TargetCard } from '../components/TargetCard';
import { TextField } from '../components/TextField';
import { en } from '../i18n/en';
import { fieldError, groupProjectErrors, type GroupedErrors } from '../lib/errors';
import { linesToList, listToLines } from '../lib/lines';
import { sourceLocaleFor } from '../lib/locale-selection';
import type { TargetId } from '../lib/sections';

interface Props {
  catalogue: Catalogue;
  project: ProjectSettings;
  onSaved: (project: ProjectSettings) => void;
  focusHeading: boolean;
}

interface FormState {
  name: string;
  targets: Record<TargetId, TargetSettings>;
  sourceLocale: string;
  locales: string[];
  allowed: string;
  forbidden: string;
  environments: Environment[];
}

const TARGETS: readonly TargetId[] = ['apple', 'google', 'web'];
const NO_ERRORS: GroupedErrors = { fields: {}, other: [] };

function toForm(project: ProjectSettings): FormState {
  return {
    name: project.name,
    targets: project.targets,
    sourceLocale: project.sourceLocale,
    locales: project.locales,
    allowed: listToLines(project.claims.allowed),
    forbidden: listToLines(project.claims.forbidden),
    environments: project.environments,
  };
}

function toProject(form: FormState): ProjectSettings {
  return {
    version: 1,
    name: form.name,
    targets: form.targets,
    sourceLocale: form.sourceLocale,
    locales: form.locales,
    claims: { allowed: linesToList(form.allowed), forbidden: linesToList(form.forbidden) },
    environments: form.environments,
  };
}

/** A new environment: the first of dev, beta, staging that is not used yet. */
function nextEnvironment(existing: readonly Environment[]): Environment {
  const candidates: Environment[] = [
    { id: 'preview', badge: 'PREVIEW', color: 'orange', style: 'badge' },
    { id: 'dev', badge: 'DEV', color: 'purple', style: 'blueprint' },
    { id: 'beta', badge: 'BETA', color: 'green', style: 'badge' },
    { id: 'staging', badge: 'STAGING', color: 'blue', style: 'badge' },
    { id: 'test', badge: 'TEST', color: 'red', style: 'badge' },
  ];
  return candidates.find((candidate) => !existing.some((e) => e.id === candidate.id)) ?? { id: '', badge: '', color: 'gray', style: 'badge' };
}

const environmentHeadingId = (index: number) => `project-environment-${index}`;

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'failed'; errors: GroupedErrors };

/** Edits the workspace settings that drive every generator. */
export function ProjectPage({ catalogue, project, onSaved, focusHeading }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(project));
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  const formRef = useRef<HTMLFormElement>(null);
  const saved =useMemo(() => JSON.stringify(toForm(project)), [project]);
  const errors = state.kind === 'failed' ? state.errors : NO_ERRORS;
  const saving = state.kind === 'saving';
  const dirty = JSON.stringify(form) !== saved;
  const selectedLocales = catalogue.locales.filter((locale) => form.locales.includes(locale.id));

  // Any edit clears the previous result: the success message and the errors of the last attempt.
  function update(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
    if (state.kind === 'saved' || state.kind === 'failed') setState({ kind: 'idle' });
  }

  function updateTarget(target: TargetId, patch: Partial<TargetSettings>) {
    update({ targets: { ...form.targets, [target]: { ...form.targets[target], ...patch } } });
  }

  const [environmentNote, setEnvironmentNote] = useState('');
  const canAddEnvironment = form.environments.length < catalogue.maxEnvironments;
  const colorOptions: Option[] = catalogue.environmentColors.map(({ id, color }) => ({ id, label: en.project.environmentColors[id], swatch: color }));
  const styleOptions: Option[] = (['badge', 'blueprint'] as const).map((id) => ({
    id,
    label: en.project.environmentStyles[id].label,
    description: en.project.environmentStyles[id].description,
  }));

  function focusLater(elementId: string) {
    requestAnimationFrame(() => document.getElementById(elementId)?.focus());
  }

  function updateEnvironment(index: number, patch: Partial<Environment>) {
    update({ environments: form.environments.map((environment, i) => (i === index ? { ...environment, ...patch } : environment)) });
  }

  function addEnvironment() {
    if (!canAddEnvironment) return;
    update({ environments: [...form.environments, nextEnvironment(form.environments)] });
    setEnvironmentNote(en.project.environmentAdded);
    focusLater(environmentHeadingId(form.environments.length));
  }

  function removeEnvironment(index: number) {
    const next = form.environments.filter((_, i) => i !== index);
    update({ environments: next });
    setEnvironmentNote(en.project.environmentRemoved);
    // Focus the card that moved into this place, the one before it, or the section heading.
    focusLater(next.length === 0 ? 'project-environments' : environmentHeadingId(Math.min(index, next.length - 1)));
  }

  function environmentErrors(index: number): Partial<Record<keyof Environment, string>> {
    const result: Partial<Record<keyof Environment, string>> = {};
    for (const field of ['id', 'badge', 'color', 'style'] as const) {
      const message = fieldError(errors, `environments.${index}.${field}`);
      if (message) result[field] = message;
    }
    return result;
  }

  // After a failed save, move focus to the first field marked invalid (it may be far above the button).
  useEffect(() => {
    if (state.kind !== 'failed') return;
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    // A fieldset (locale selector) is not focusable itself; focus its first control instead.
    const target = invalid instanceof HTMLFieldSetElement ? invalid.querySelector<HTMLElement>('input') : invalid;
    target?.focus();
  }, [state]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    // The button stays focusable (aria-disabled) while saving, so focus is not lost; repeated submits are ignored.
    if (saving) return;
    setState({ kind: 'saving' });
    try {
      const stored = await saveProject(toProject(form));
      // The fields are disabled while saving, so the stored (normalized) settings can replace the form.
      setForm(toForm(stored));
      setState({ kind: 'saved' });
      onSaved(stored);
    } catch (error) {
      const messages = error instanceof ApiError ? error.messages : [String(error)];
      setState({ kind: 'failed', errors: groupProjectErrors(messages) });
    }
  }

  return (
    <>
      <PageHeader title={en.sections.project.title} description={en.sections.project.description} focusOnMount={focusHeading} />
      <form ref={formRef} className="flex flex-col gap-8" onSubmit={submit} noValidate aria-busy={saving}>
        {/* `contents` keeps the layout; `disabled` blocks edits that a finishing save would overwrite. */}
        <fieldset className="contents" disabled={saving}>
        <section aria-labelledby="project-app" className="flex flex-col gap-2">
          <h2 id="project-app" className="text-xl font-semibold">
            {en.project.appHeading}
          </h2>
          <TextField
            label={en.project.nameLabel}
            hint={en.project.nameHint}
            value={form.name}
            onChange={(name) => update({ name })}
            error={fieldError(errors, 'name')}
            required
            maxLength={100}
          />
        </section>

        <section aria-labelledby="project-languages" className="flex flex-col gap-2">
          <h2 id="project-languages" className="text-xl font-semibold">
            {en.project.languagesHeading}
          </h2>
          <LocaleSelector
            label={en.project.localesLabel}
            hint={en.project.localesHint}
            mode="multiple"
            options={catalogue.locales}
            value={form.locales}
            onChange={(locales) => update({ locales, sourceLocale: sourceLocaleFor(form.sourceLocale, locales) })}
            error={fieldError(errors, 'locales')}
          />
          <LocaleSelector
            label={en.project.sourceLocaleLabel}
            hint={en.project.sourceLocaleHint}
            mode="single"
            options={selectedLocales}
            value={[form.sourceLocale]}
            onChange={([sourceLocale]) => update({ sourceLocale: sourceLocale ?? form.sourceLocale })}
            error={fieldError(errors, 'sourceLocale')}
          />
        </section>

        <section aria-labelledby="project-targets" className="flex flex-col gap-4">
          <h2 id="project-targets" className="text-xl font-semibold">
            {en.project.targetsHeading}
          </h2>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {TARGETS.map((target) => (
              <TargetCard
                key={target}
                title={en.targets[target]}
                enabled={form.targets[target].enabled}
                onEnabledChange={(enabled) => updateTarget(target, { enabled })}
                devices={catalogue.devices[target]}
                selected={form.targets[target].devices}
                onSelectedChange={(devices) => updateTarget(target, { devices })}
                error={fieldError(errors, `targets.${target}`)}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="project-environments" className="flex flex-col gap-4">
          <h2 id="project-environments" tabIndex={-1} className="text-xl font-semibold focus:outline-none">
            {en.project.environmentsHeading}
          </h2>
          <p className="max-w-prose text-base-content/70">{en.project.environmentsIntro}</p>
          <p className="sr-only" role="status">
            {environmentNote}
          </p>
          {form.environments.length === 0 ? <p>{en.project.noEnvironments}</p> : null}
          <ol className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {form.environments.map((environment, index) => (
              <li key={index}>
                <EnvironmentCard
                  position={index}
                  values={environment}
                  headingId={environmentHeadingId(index)}
                  onChange={(patch) => updateEnvironment(index, patch)}
                  onRemove={() => removeEnvironment(index)}
                  colorOptions={colorOptions}
                  styleOptions={styleOptions}
                  errors={environmentErrors(index)}
                />
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-outline min-h-11"
              aria-disabled={!canAddEnvironment}
              onClick={addEnvironment}
            >
              {en.project.addEnvironment}
            </button>
            <span className="text-sm text-base-content/70">{en.project.maxEnvironments(catalogue.maxEnvironments)}</span>
          </div>
        </section>

        <section aria-labelledby="project-claims" className="flex flex-col gap-2">
          <h2 id="project-claims" className="text-xl font-semibold">
            {en.project.claimsHeading}
          </h2>
          <p className="max-w-prose text-base-content/70">{en.project.claimsIntro}</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              multiline
              label={en.project.allowedLabel}
              hint={en.project.claimsHint}
              value={form.allowed}
              onChange={(allowed) => update({ allowed })}
              error={fieldError(errors, 'claims.allowed')}
            />
            <TextField
              multiline
              label={en.project.forbiddenLabel}
              hint={en.project.claimsHint}
              value={form.forbidden}
              onChange={(forbidden) => update({ forbidden })}
              error={fieldError(errors, 'claims.forbidden')}
            />
          </div>
        </section>
        </fieldset>

        {/* Sticky, so the Save button and the unsaved-changes badge stay in view on long phone screens. */}
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t border-base-300 bg-base-200 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {/* Live regions stay mounted so the first message is announced; the alerts inside have no own role. */}
          <div role="status">
            {state.kind === 'saved' ? <StatusAlert announce={false} tone="success" title={en.project.saved} /> : null}
          </div>
          <div role="alert">
            {state.kind === 'failed' ? (
              <StatusAlert announce={false} tone="error" title={en.project.saveFailed}>
                {errors.other.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {errors.other.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                ) : null}
              </StatusAlert>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BusyButton type="submit" primary busy={saving} busyLabel={en.project.saving}>
              {en.project.save}
            </BusyButton>
            {dirty ? <span className="badge badge-outline">{en.project.unsaved}</span> : null}
          </div>
        </div>
      </form>
    </>
  );
}
