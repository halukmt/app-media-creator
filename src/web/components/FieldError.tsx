interface Props {
  /** Referenced by the control's `aria-describedby`. */
  id: string;
  children: string;
  /** `warning` for advice the user may ignore; default `error`. */
  tone?: 'error' | 'warning';
}

/** The error or warning text below a form control; the control points to it with `aria-describedby`. */
export function FieldError({ id, children, tone = 'error' }: Props) {
  return (
    <p id={id} className={`border-l-4 pl-2 text-sm font-medium ${tone === 'warning' ? 'border-warning' : 'border-error'}`}>
      {children}
    </p>
  );
}
