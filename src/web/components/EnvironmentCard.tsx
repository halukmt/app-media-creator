import type { Environment } from '../api';
import { en } from '../i18n/en';
import { OptionGroup, type Option } from './OptionGroup';
import { TextField } from './TextField';

interface Props {
  /** 0-based position in the list, for the heading. */
  position: number;
  values: Environment;
  onChange: (patch: Partial<Environment>) => void;
  onRemove: () => void;
  colorOptions: readonly Option[];
  styleOptions: readonly Option[];
  /** Element id of the heading, so the page can move focus to it after adding or removing. */
  headingId: string;
  /** Longest label text (from the catalogue). */
  maxBadgeLength: number;
  errors?: Partial<Record<keyof Environment, string>>;
}

/**
 * One non-production environment (preview, dev, beta) on the Project screen: folder name, label text, label colour and
 * style of its icon variants, with a remove action.
 */
export function EnvironmentCard({ position, values, onChange, onRemove, colorOptions, styleOptions, headingId, maxBadgeLength, errors = {} }: Props) {
  const title = en.project.environmentLegend(values.badge, position);
  return (
    <section className="card card-sm border border-base-300 bg-base-100" aria-labelledby={headingId}>
      {/* A container, so the fields sit side by side only when the card itself is wide (cards are two per row on xl). */}
      <div className="@container card-body gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={headingId} tabIndex={-1} className="card-title text-base wrap-anywhere focus:outline-none">
            {title}
          </h3>
          <button type="button" className="btn btn-ghost btn-sm min-h-11" onClick={onRemove} aria-label={en.project.removeEnvironment(values.badge)}>
            {en.project.removeShort}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
          <TextField
            label={en.project.environmentIdLabel}
            hint={en.project.environmentIdHint}
            value={values.id}
            onChange={(next) => onChange({ id: next.toLowerCase() })}
            maxLength={20}
            required
            {...(errors.id ? { error: errors.id } : {})}
          />
          <TextField
            label={en.project.environmentBadgeLabel}
            hint={en.project.environmentBadgeHint}
            value={values.badge}
            // Locale-independent upper case (a Turkish browser must not turn "i" into "İ"); "ß" becomes "SS" and could
            // exceed the limit, so the result is cut to it.
            onChange={(next) => onChange({ badge: next.toLocaleUpperCase('en-US').slice(0, maxBadgeLength) })}
            maxLength={maxBadgeLength}
            required
            {...(errors.badge ? { error: errors.badge } : {})}
          />
        </div>
        <OptionGroup
          label={en.project.environmentColorLabel}
          options={colorOptions}
          value={[values.color]}
          onSelect={(color) => onChange({ color: color as Environment['color'] })}
          {...(errors.color ? { error: errors.color } : {})}
        />
        <OptionGroup
          label={en.project.environmentStyleLabel}
          variant="card"
          options={styleOptions}
          value={[values.style]}
          onSelect={(style) => onChange({ style: style as Environment['style'] })}
          {...(errors.style ? { error: errors.style } : {})}
        />
      </div>
    </section>
  );
}
