import { useEffect, useId, useRef, type ReactNode } from 'react';
import { en } from '../i18n/en';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** Called for Cancel, Escape and a click on the backdrop. */
  onCancel: () => void;
}

/**
 * Modal confirmation on the native `<dialog>`: the browser keeps focus inside, makes the page inert and closes on
 * Escape. Focus starts on Cancel, the safe choice. The caller returns focus to the control that opened it.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel, onConfirm, onCancel }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      cancel.current?.focus();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      // Escape closes the native dialog; keep React state in sync.
      onClose={() => {
        if (open) onCancel();
      }}
    >
      <div className="modal-box">
        <h2 id={`${id}-title`} className="text-lg font-bold">
          {title}
        </h2>
        <div id={`${id}-body`} className="py-4">
          {children}
        </div>
        <div className="modal-action">
          <button ref={cancel} type="button" className="btn min-h-11" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn-primary min-h-11" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
      {/* Click outside the box closes the dialog; keyboard users have Cancel and Escape. */}
      <form method="dialog" className="modal-backdrop">
        <button type="submit" tabIndex={-1}>
          {en.app.closeDialog}
        </button>
      </form>
    </dialog>
  );
}
