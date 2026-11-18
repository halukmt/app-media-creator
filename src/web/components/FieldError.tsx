interface Props {
  /** Referenced by the control's `aria-describedby`. */
  id: string;
  children: string;
}

/** The error text below a form control; the control points to it with `aria-describedby` and sets `aria-invalid`. */
export function FieldError({ id, children }: Props) {
  return (
    <p id={id} className="border-l-4 border-error pl-2 text-sm font-medium">
      {children}
    </p>
  );
}
