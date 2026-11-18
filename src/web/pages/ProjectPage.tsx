import { useState, type FormEvent } from 'react';
import { ApiError, saveProject, type Catalogue, type ProjectSettings, type TargetSettings } from '../api';
import { LocaleSelector } from '../components/LocaleSelector';
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
  };
}

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'failed'; errors: GroupedErrors };

/** Edits the workspace settings that drive every generator. */
export function ProjectPage({ catalogue, project, onSaved, focusHeading }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(project));
  const [saved, setSaved] = useState<FormState>(() => toForm(project));
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  const errors = state.kind === 'failed' ? state.errors : NO_ERRORS;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const selectedLocales = catalogue.locales.filter((locale) => form.locales.includes(locale.id));

  function update(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
    if (state.kind === 'saved') setState({ kind: 'idle' });
  }

  function updateTarget(target: TargetId, patch: Partial<TargetSettings>) {
    update({ targets: { ...form.targets, [target]: { ...form.targets[target], ...patch } } });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState({ kind: 'saving' });
    try {
      const stored = await saveProject(toProject(form));
      const next = toForm(stored);
      setForm(next);
      setSaved(next);
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
      <form className="flex flex-col gap-8" onSubmit={submit} noValidate>
        <section aria-labelledby="project-app" className="flex flex-col gap-2">
          <h2 id="project-app" className="text-lg font-semibold">
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
          <h2 id="project-languages" className="text-lg font-semibold">
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
          <h2 id="project-targets" className="text-lg font-semibold">
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

        <section aria-labelledby="project-claims" className="flex flex-col gap-2">
          <h2 id="project-claims" className="text-lg font-semibold">
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

        <div className="flex flex-col gap-3">
          <div aria-live="polite">
            {state.kind === 'saved' ? <StatusAlert tone="success" title={en.project.saved} /> : null}
          </div>
          <div aria-live="assertive">
            {state.kind === 'failed' ? (
              <StatusAlert tone="error" title={en.project.saveFailed}>
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
            <button type="submit" className="btn btn-primary min-h-11" disabled={state.kind === 'saving'}>
              {state.kind === 'saving' ? <span className="loading loading-spinner" aria-hidden="true" /> : null}
              {state.kind === 'saving' ? en.project.saving : en.project.save}
            </button>
            {dirty ? <span className="badge badge-outline">{en.project.unsaved}</span> : null}
          </div>
        </div>
      </form>
    </>
  );
}
