import { useEffect, useRef, useState } from 'react';
import { cx } from '../../design';

export interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  /** Accessible name for the input and button, e.g. "Nombre de la columna". */
  label: string;
  className?: string;
  maxLength?: number;
}

/**
 * Click-to-edit text. Enter or blur saves, Escape cancels.
 * Empty values are discarded (the previous value stays).
 */
export function InlineEdit({ value, onSave, label, className, maxLength = 80 }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    else setDraft(value);
  };

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`${label}: ${value}. Pulsa para editar`}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={cx('min-w-0 cursor-text truncate text-left', className)}
      >
        {value}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      aria-label={label}
      value={draft}
      maxLength={maxLength}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
      className={cx(
        'min-w-0 rounded-md border border-accent bg-card px-1 shadow-[0_0_0_3px_var(--accent-soft)] outline-none',
        className,
      )}
    />
  );
}
