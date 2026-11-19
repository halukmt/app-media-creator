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
}

/** L4 preview of one generated asset: picture, name, size, validation state and the messages behind it. */
export function PreviewCard({ media, title, size, status, messages, checkered = false }: Props) {
  return (
    <li className="card card-sm border border-base-300 bg-base-100">
      {media ? <figure className={checkered ? 'bg-[repeating-conic-gradient(var(--color-base-300)_0_25%,color-mix(in_oklab,var(--color-base-content)_30%,transparent)_0_50%)] bg-size-[16px_16px] p-2' : 'bg-base-200 p-2'}>{media}</figure> : null}
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
