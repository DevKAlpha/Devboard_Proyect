import { useState } from 'react';
import { Button, IconButton, PixelIcon, Textarea } from '../../design';

export interface ComposerProps {
  /** Text of the collapsed trigger, e.g. "Añadir tarjeta". */
  triggerLabel: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (text: string) => void;
}

/**
 * Inline "add item" composer (Trello-style).
 * Enter submits and keeps the composer open for fast entry; Escape closes it.
 */
export function Composer({ triggerLabel, placeholder, submitLabel, onSubmit }: ComposerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const submit = () => {
    if (!text.trim()) return;
    onSubmit(text);
    setText('');
  };

  if (!open) {
    return (
      <Button variant="ghost" className="w-full justify-start" onClick={() => setOpen(true)}>
        <PixelIcon name="plus" />
        {triggerLabel}
      </Button>
    );
  }

  return (
    <div className="flex animate-pixel-pop flex-col gap-2">
      <Textarea
        autoFocus
        rows={2}
        aria-label={placeholder}
        placeholder={placeholder}
        value={text}
        maxLength={200}
        className="min-h-16"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={submit}>
          {submitLabel}
        </Button>
        <IconButton icon="close" label="Cancelar" onClick={() => setOpen(false)} />
      </div>
    </div>
  );
}
