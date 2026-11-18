import { useId, type ReactNode } from 'react';
import { en } from '../i18n/en';

interface Props {
  title: string;
  /** What to upload or do. */
  children: ReactNode;
  /** Display names of the enabled stores that need this section. */
  neededBy: readonly string[];
  actions?: ReactNode;
}

/** L6 empty state of a section: what to upload and which of the enabled stores need it. */
export function EmptyState({ title, children, neededBy, actions }: Props) {
  const titleId = useId();
  return (
    <section className="card card-dash border-base-300 bg-base-100" aria-labelledby={titleId}>
      <div className="card-body gap-3 p-4 sm:p-6">
        <h2 id={titleId} className="card-title">
          {title}
        </h2>
        <div className="max-w-prose">{children}</div>
        {neededBy.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{en.empty.neededBy}</span>
            <ul className="flex flex-wrap gap-2">
              {neededBy.map((name) => (
                <li key={name} className="badge badge-outline">
                  {name}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm">{en.empty.noTarget}</p>
        )}
        {actions ? <div className="card-actions">{actions}</div> : null}
      </div>
    </section>
  );
}
