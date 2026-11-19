interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A labelled on/off switch; the whole row (44 px) is the tap target. */
export function ToggleField({ label, checked, onChange }: Props) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        role="switch"
        className="toggle toggle-success"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
