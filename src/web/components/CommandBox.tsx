import { useEffect, useId, useRef, useState } from 'react';
import { en } from '../i18n/en';

interface Props {
  /** Label above the box, e.g. "Run this in Claude Code". */
  label: string;
  command: string;
}

/**
 * A command to run elsewhere, read-only in a code box, with a copy button that shows "Copied". Long paths wrap. If the
 * clipboard is not available, the button selects the command and says how to copy it by hand.
 */
export function CommandBox({ label, command }: Props) {
  const id = useId();
  const [state, setState] = useState<'idle' | 'copied' | 'selected'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(command);
      setState('copied');
      timer.current = setTimeout(() => setState('idle'), 2000);
    } catch {
      const node = document.getElementById(`${id}-code`);
      if (node) window.getSelection()?.selectAllChildren(node);
      setState('selected');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p id={`${id}-label`} className="text-sm font-semibold">
        {label}
      </p>
      {/* DaisyUI sizes the pre to its content; full width and pre-wrap let long paths wrap instead of scrolling. */}
      <div className="mockup-code w-full">
        <pre aria-labelledby={`${id}-label`} className="w-full! min-w-0! whitespace-pre-wrap! wrap-anywhere">
          <code id={`${id}-code`} className="whitespace-pre-wrap wrap-anywhere">
            {command}
          </code>
        </pre>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-sm min-h-11" onClick={() => void copy()}>
          {en.common.copy}
        </button>
        <span role="status" className="text-sm text-base-content/70">
          {state === 'copied' ? en.common.copied : state === 'selected' ? en.common.selectedToCopy : ''}
        </span>
      </div>
    </div>
  );
}
