import { en } from '../i18n/en';

export interface Step {
  id: string;
  label: string;
  /** Cannot be opened yet (e.g. before the first upload). */
  disabled?: boolean;
}

interface Props {
  steps: readonly Step[];
  current: string;
  onSelect: (id: string) => void;
  /** Why disabled steps are unavailable, shown next to the bar. */
  unavailableHint?: string;
}

/**
 * L2 step flow of an asset section (Upload → Purpose → Preview and edit → Export). Steps are buttons in order; the
 * current one is marked for screen readers, done and current steps are coloured.
 */
export function StepsBar({ steps, current, onSelect, unavailableHint }: Props) {
  const currentIndex = steps.findIndex((step) => step.id === current);
  return (
    <nav aria-label={en.steps.label} className="flex flex-col gap-1">
      <ol className="steps w-full">
        {steps.map((step, index) => (
          <li key={step.id} className={`step ${index <= currentIndex ? 'step-primary' : ''}`}>
            <button
              type="button"
              className="btn btn-ghost btn-sm min-h-11 h-auto whitespace-normal px-1 font-medium"
              aria-current={step.id === current ? 'step' : undefined}
              aria-disabled={step.disabled ? true : undefined}
              onClick={() => {
                if (!step.disabled) onSelect(step.id);
              }}
            >
              {step.label}
            </button>
          </li>
        ))}
      </ol>
      {unavailableHint && steps.some((step) => step.disabled) ? <p className="text-sm text-base-content/70">{unavailableHint}</p> : null}
    </nav>
  );
}
