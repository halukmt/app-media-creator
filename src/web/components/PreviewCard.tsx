import type { ReactNode } from 'react';
import { en } from '../i18n/en';
import type { CheckStatus } from '../lib/export';
import { StatusBadge } from './StatusBadge';

interface Props {
  /** The picture (an img, later a video), already with its alt text. */
  media: ReactNode;
  title: string;
  /** Pixel size of the real asset, e.g. "1179 × 2556". */
  size: string;
  status: CheckStatus;
  messages: readonly string[];
}

/** L4 preview of one generated asset: picture, name, size, validation state and the messages behind it. */
export function PreviewCard({ media, title, size, status, messages }: Props) {
  return (
    <li className="card card-border card-sm bg-base-100">
      <figure className="bg-base-200 p-2">{media}</figure>
      <div className="card-body gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{title}</p>
          <StatusBadge status={status} />
        </div>
        <p className="text-sm text-base-content/70">{size}</p>
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
