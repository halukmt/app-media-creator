import { useId } from 'react';
import { en } from '../i18n/en';
import { OptionGroup, type Option } from './OptionGroup';
import { TextField } from './TextField';

export interface SlotValues {
  headline: string;
  subline: string;
  /** Option id of the slot's layout, background and frame; `inherit` means the section style. */
  layout: string;
  background: string;
  frame: string;
}

interface Props {
  position: number;
  total: number;
  thumbnailUrl: string;
  fileName: string;
  /** Media locale of the texts, for spell-check and pronunciation. */
  locale: string;
  values: SlotValues;
  onChange: (patch: Partial<SlotValues>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  layoutOptions: readonly Option[];
  backgroundOptions: readonly Option[];
  frameOptions: readonly Option[];
}

const ICON_BUTTON = 'btn btn-square btn-ghost min-h-11 min-w-11';

/**
 * One screenshot of a set: thumbnail, headline and subline, buttons to move or remove it, and a collapsible style
 * override (layout, background, frame) with "Same as section style" as the default.
 */
export function SlotEditor({
  position,
  total,
  thumbnailUrl,
  fileName,
  locale,
  values,
  onChange,
  onMove,
  onRemove,
  layoutOptions,
  backgroundOptions,
  frameOptions,
}: Props) {
  const titleId = useId();
  const first = position === 1;
  const last = position === total;
  return (
    <li className="card card-border bg-base-100 sm:card-side" aria-labelledby={titleId}>
      <figure className="bg-base-200 p-3 sm:w-36">
        <img src={thumbnailUrl} alt={en.screenshots.thumbAlt(position, fileName)} className="max-h-48 w-auto rounded" />
      </figure>
      <div className="card-body gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={titleId} tabIndex={-1} className="card-title text-base focus:outline-none">
            {en.screenshots.slotHeading(position, total)}
          </h3>
          <div className="flex gap-1">
            {/* aria-disabled at the edges keeps focus on the button instead of dropping it. */}
            <button type="button" className={ICON_BUTTON} aria-label={en.screenshots.moveUp(position)} aria-disabled={first} onClick={() => !first && onMove(-1)}>
              <span aria-hidden="true">↑</span>
            </button>
            <button type="button" className={ICON_BUTTON} aria-label={en.screenshots.moveDown(position)} aria-disabled={last} onClick={() => !last && onMove(1)}>
              <span aria-hidden="true">↓</span>
            </button>
            <button type="button" className={ICON_BUTTON} aria-label={en.screenshots.remove(position)} onClick={onRemove}>
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>
        <TextField label={en.screenshots.headlineLabel} value={values.headline} onChange={(headline) => onChange({ headline })} maxLength={200} lang={locale} />
        <TextField label={en.screenshots.sublineLabel} value={values.subline} onChange={(subline) => onChange({ subline })} maxLength={200} lang={locale} />
        <details className="collapse collapse-arrow border border-base-300">
          <summary className="collapse-title min-h-11 font-medium">{en.screenshots.overrides}</summary>
          <div className="collapse-content flex flex-col gap-2">
            <OptionGroup label={en.screenshots.layoutLabel} options={layoutOptions} value={[values.layout]} onSelect={(layout) => onChange({ layout })} />
            <OptionGroup label={en.screenshots.backgroundLabel} options={backgroundOptions} value={[values.background]} onSelect={(background) => onChange({ background })} />
            <OptionGroup label={en.screenshots.frameLabel} options={frameOptions} value={[values.frame]} onSelect={(frame) => onChange({ frame })} />
          </div>
        </details>
      </div>
    </li>
  );
}
