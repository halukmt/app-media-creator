import { en } from '../i18n/en';

/** Marks an asset or device model the store requires. */
export function RequiredBadge() {
  return <span className="badge badge-sm badge-outline shrink-0">{en.target.required}</span>;
}
