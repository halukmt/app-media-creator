import { en } from '../i18n/en';

interface Props {
  /** Marker text; default "Required". Also used for markers like "Comes later". */
  label?: string;
}

/** Outline marker next to an option or asset: "Required" by default. */
export function RequiredBadge({ label = en.target.required }: Props) {
  return <span className="badge badge-sm badge-outline shrink-0">{label}</span>;
}
