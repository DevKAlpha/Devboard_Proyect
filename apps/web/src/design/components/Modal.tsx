import { useEffect, useRef, type ReactNode } from 'react';
import { IconButton } from './IconButton';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Modal built on the native <dialog> element: focus trapping, Esc to close
 * and top-layer stacking come from the browser, so no extra library is needed.
 */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // showModal() is missing in jsdom; optional call keeps components testable.
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      // A click on the dialog element itself is a click on the backdrop.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-[min(560px,calc(100vw-32px))] animate-pixel-pop rounded-2xl border border-line-soft bg-surface p-0 text-ink shadow-lift backdrop:bg-black/30 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="flex flex-col gap-4 p-5">
          <header className="flex items-start justify-between gap-4">
            <h2 className="text-xl">{title}</h2>
            <IconButton icon="close" label="Cerrar" onClick={onClose} />
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
