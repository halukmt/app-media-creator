import { useId, type ReactNode } from 'react';
import { en } from '../i18n/en';
import type { CheckStatus } from '../lib/export';
import { OptionGroup, type Option } from './OptionGroup';
import { StatusBadge } from './StatusBadge';
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
  /** The rendered card preview (or the raw screenshot while it loads), already with its alt text. */
  media: ReactNode;
  /** Validation state of the preview; omitted while it loads. */
  status?: CheckStatus;
  /** Warnings of the preview, shown under the texts. */
  messages: readonly string[];
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

const ICON_BUTTON = 'btn btn-square btn-ghost min-h-11 min-w-11 aria-disabled:opacity-40';

function Icon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

/**
 * One screenshot of a set: its card preview with validation state next to the headline and subline, buttons to move
 * or remove it, and a collapsible style override (layout, background, frame) defaulting to the section style.
 */
export function SlotEditor({
  position,
  total,
  media,
  status,
  messages,
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
    <li className="card card-side border border-base-300 bg-base-100" aria-labelledby={titleId}>
      <figure className="w-24 shrink-0 self-start bg-base-300 p-2 sm:w-40">{media}</figure>
      <div className="card-body min-w-0 gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 id={titleId} tabIndex={-1} data-slot-heading className="card-title text-base focus:outline-none">
              {en.screenshots.slotHeading(position, total)}
            </h4>
            {status ? <StatusBadge status={status} /> : null}
          </div>
          <div className="flex gap-1">
            {/* aria-disabled at the edges keeps focus on the button instead of dropping it. */}
            <button type="button" className={ICON_BUTTON} aria-label={en.screenshots.moveUp(position)} aria-disabled={first} onClick={() => !first && onMove(-1)}>
              <Icon path="M10 15V5M5 10l5-5 5 5" />
            </button>
            <button type="button" className={ICON_BUTTON} aria-label={en.screenshots.moveDown(position)} aria-disabled={last} onClick={() => !last && onMove(1)}>
              <Icon path="M10 5v10M5 10l5 5 5-5" />
            </button>
            <button type="button" className={ICON_BUTTON} aria-label={en.screenshots.remove(position)} onClick={onRemove}>
              <Icon path="M5 5l10 10M15 5L5 15" />
            </button>
          </div>
        </div>
        {messages.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm wrap-anywhere">
            {messages.map((message, index) => (
              <li key={index}>
                <span className="font-semibold">{en.status.warning}:</span> {message}
              </li>
            ))}
          </ul>
        ) : null}
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
