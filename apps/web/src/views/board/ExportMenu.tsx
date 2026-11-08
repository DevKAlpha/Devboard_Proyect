import { useEffect, useRef, useState } from 'react';
import type { Board } from '@devbord/shared';
import { Button, PixelIcon } from '../../design';
import { boardFileName, serializeBoard } from '../../models/boardFile';
import { downloadBlob, renderBoardPng } from './exportPng';

/** "Exportar" button with a small menu: JSON (re-importable) or PNG (image). */
export function ExportMenu({ board }: { board: Board }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape, like a native menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const exportJson = () => {
    const blob = new Blob([serializeBoard(board)], { type: 'application/json' });
    downloadBlob(blob, boardFileName(board, 'json'));
    setOpen(false);
  };

  const exportPng = async () => {
    setBusy(true);
    try {
      downloadBlob(await renderBoardPng(board), boardFileName(board, 'png'));
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const item =
    'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-3/70';

  return (
    <div ref={ref} className="relative">
      <Button
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <PixelIcon name="download" />
        Exportar
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 flex w-52 animate-pixel-pop flex-col rounded-xl border border-line-soft bg-surface p-1 shadow-lift"
        >
          <button role="menuitem" className={item} onClick={exportJson}>
            <PixelIcon name="text" /> JSON (para importar)
          </button>
          <button role="menuitem" className={item} disabled={busy} onClick={() => void exportPng()}>
            <PixelIcon name="board" /> {busy ? 'Generando…' : 'Imagen PNG'}
          </button>
        </div>
      )}
    </div>
  );
}
