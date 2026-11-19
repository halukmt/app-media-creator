import type { ReactNode } from 'react';
import { en } from '../i18n/en';
import type { CheckStatus } from '../lib/export';
import { StatusBadge } from './StatusBadge';

interface Props {
  /** The picture (an img, later a video), already with its alt text; omitted for documents without a preview. */
  media?: ReactNode;
  title: string;
  /** File name and pixel size of the real asset, e.g. "app-icon.png · 1024 × 1024 px". */
  size?: string;
  /** Validation state; omitted while the preview is still loading. */
  status?: CheckStatus;
  messages: readonly string[];
  /** Checkerboard behind the media, so white or black marks on transparency stay visible. */
  checkered?: boolean;
  /**
   * A guide rectangle drawn over the media (e.g. the art safe area), in percent of the media size. Decorative: the
   * same information belongs in `size` or `messages` as text.
   */
  guide?: { x: number; y: number; width: number; height: number };
}

/** L4 preview of one generated asset: picture, name, size, validation state and the messages behind it. */
export function PreviewCard({ media, title, size, status, messages, checkered = false, guide }: Props) {
  const backdrop = checkered
    ? 'bg-[repeating-conic-gradient(var(--color-base-300)_0_25%,color-mix(in_oklab,var(--color-base-content)_30%,transparent)_0_50%)] bg-size-[16px_16px]'
    : 'bg-base-200';
  return (
    <li className="card card-sm border border-base-300 bg-base-100">
      {media ? (
        <figure className={`${backdrop} p-2`}>
          {guide ? (
            <div className="relative w-full">
              {media}
              {/* Dashed light line with a dark ring, so the guide shows on light and dark artwork. */}
              <div
                aria-hidden="true"
                data-testid="preview-guide"
                className="pointer-events-none absolute rounded-sm border-2 border-dashed border-base-100 outline-2 outline-base-content/60"
                style={{ left: `${guide.x}%`, top: `${guide.y}%`, width: `${guide.width}%`, height: `${guide.height}%` }}
              />
            </div>
          ) : (
            media
          )}
        </figure>
      ) : null}
      <div className="card-body gap-1">
        <div className="flex flex-col items-start gap-1">
          <p className="grow-0 text-sm font-semibold">{title}</p>
          {status ? <StatusBadge status={status} /> : null}
        </div>
        {size ? <p className="grow-0 text-xs text-base-content/70 wrap-anywhere">{size}</p> : null}
        {messages.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm wrap-anywhere">
            {messages.map((message, index) => (
              <li key={index}>
                <span className="font-semibold">{en.status[status === 'error' ? 'error' : 'warning']}:</span> {message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}
