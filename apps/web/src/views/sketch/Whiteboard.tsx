/**
 * The whiteboard ("pizarra") overlay: a floating sheet above the Kanban board
 * for quick explanations and sketches, alone or with the team.
 *
 * Layout: header (title, live status, expand, close) · sheet · dock with the
 * tools. It floats over the board (which stays visible behind a soft blur)
 * and can be expanded to fill the window for an immersive session.
 *
 * Keyboard: P lápiz · M marcador · A flecha · R rectángulo · O círculo ·
 * T texto · N nota · E borrador · [ ] grosor · Ctrl+Z / Ctrl+Shift+Z ·
 * Esc closes (or leaves the note being edited first).
 *
 * Loaded lazily: none of this ships until the first time someone opens it.
 */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useCollab } from '../../controllers/collabController';
import {
  INK_COLORS,
  NOTE_COLORS,
  useSketch,
  useSketchSnapshot,
  type InkColor,
  type NoteColor,
  type SketchTool,
} from '../../controllers/sketchController';
import {
  IconButton,
  PixelIcon,
  animateIn,
  animateLand,
  animateOut,
  confirm,
  cx,
  type IconName,
} from '../../design';
import { SheetSwitcher } from './SheetSwitcher';
import { SketchSheet, type SketchSheetHandle } from './SketchSheet';
import './sketch.css';

const TOOLS: ReadonlyArray<{ tool: SketchTool; icon: IconName; label: string; key: string }> = [
  { tool: 'pen', icon: 'edit', label: 'Lápiz', key: 'p' },
  { tool: 'marker', icon: 'marker', label: 'Marcador', key: 'm' },
  { tool: 'arrow', icon: 'arrow', label: 'Flecha', key: 'a' },
  { tool: 'rect', icon: 'square', label: 'Rectángulo', key: 'r' },
  { tool: 'ellipse', icon: 'circle', label: 'Círculo', key: 'o' },
  { tool: 'text', icon: 'type', label: 'Texto', key: 't' },
  { tool: 'note', icon: 'note', label: 'Nota (arrástrala al tablero)', key: 'n' },
  { tool: 'eraser', icon: 'eraser', label: 'Borrador (o clic derecho)', key: 'e' },
  { tool: 'laser', icon: 'laser', label: 'Puntero láser: señala sin dibujar', key: 'l' },
];

const INK_NAMES: Record<InkColor, string> = {
  ink: 'Tinta',
  blue: 'Azul',
  red: 'Rojo',
  green: 'Verde',
  orange: 'Naranja',
  purple: 'Morado',
};
const NOTE_NAMES: Record<NoteColor, string> = {
  yellow: 'Amarilla',
  pink: 'Rosa',
  blue: 'Azul',
  green: 'Verde',
};

/** Drag distance (px) that turns a press on the note button into "peel a note off the pad". */
const PEEL_SLOP = 6;

export default function Whiteboard({ boardName, team }: { boardName: string; team: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<SketchSheetHandle>(null);
  const model = useSketch((s) => s.model);
  const expanded = useSketch((s) => s.expanded);
  const tool = useSketch((s) => s.tool);
  const color = useSketch((s) => s.color);
  const sizeStep = useSketch((s) => s.sizeStep);
  const noteColor = useSketch((s) => s.noteColor);
  const { canUndo, canRedo, strokes, notes } = useSketchSnapshot();
  const peerList = useCollab((s) => s.peers);
  const peers = Object.keys(peerList).length;
  const sheetId = useSketch((s) => s.sheetId);
  const status = useCollab((s) => s.status);
  /** Note being peeled off the pad (screen position), if any. */
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

  const close = async () => {
    await animateOut(dialogRef.current);
    useSketch.getState().hide();
  };

  // Open as a modal dialog: top layer, focus stays inside, Esc handled below.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal?.();
    animateIn(dialog);
  }, []);

  // Keyboard shortcuts (never while typing in a note).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Keys sent to window/document have no element target.
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest('textarea, input, select, [contenteditable="true"]')) {
        // The browser undo stack is page-wide: in an empty note it would edit another one.
        const field = target as HTMLTextAreaElement;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !field.value)
          e.preventDefault();
        return;
      }
      const { model: m, setTool, setSizeStep, sizeStep: step } = useSketch.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) m?.redo();
        else m?.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        m?.redo();
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === '[') setSizeStep(Math.max(0, step - 1) as 0 | 1 | 2);
      if (e.key === ']') setSizeStep(Math.min(2, step + 1) as 0 | 1 | 2);
      const hit = TOOLS.find((t) => t.key === e.key.toLowerCase());
      if (hit) setTool(hit.tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** Press on the note button: a click picks the tool, a drag peels a note off the pad. */
  const onNotePadDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY };
    let peeling = false;
    const move = (ev: PointerEvent) => {
      if (!peeling && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < PEEL_SLOP) return;
      peeling = true;
      setGhost({ x: ev.clientX, y: ev.clientY });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setGhost(null);
      if (!peeling) return;
      const p = sheetRef.current?.toSheet(ev.clientX, ev.clientY);
      if (p) sheetRef.current?.placeNote('note', p.x, p.y);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const pick = (next: SketchTool, el: HTMLElement) => {
    useSketch.getState().setTool(next);
    animateLand(el);
  };

  const empty = strokes.length === 0 && notes.length === 0;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Pizarra"
      className={cx(
        'sk-root m-auto max-h-none max-w-none flex-col overflow-hidden rounded-2xl border border-line-soft bg-surface p-0 text-ink shadow-lift outline-none open:flex',
        'backdrop:bg-black/25 backdrop:backdrop-blur-[3px]',
        expanded
          ? 'h-[calc(100dvh-16px)] w-[calc(100vw-16px)]'
          : 'h-[min(760px,calc(100dvh-32px))] w-[min(1180px,calc(100vw-32px))]',
      )}
      onCancel={(e) => {
        // Esc while writing a note only leaves the note.
        e.preventDefault();
        const active = document.activeElement;
        if (active instanceof HTMLTextAreaElement) active.blur();
        else void close();
      }}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line-soft px-3">
        <PixelIcon name="sketch" className="text-accent" />
        <h2 className="text-lg">Pizarra</h2>
        <span className="hidden max-w-40 shrink-0 truncate text-sm text-muted sm:inline">
          {boardName} ·
        </span>
        <SheetSwitcher key={sheetId} team={team} />
        {team && (
          <span
            className={cx(
              'ml-1 shrink-0 rounded-full px-2 py-0.5 text-xs',
              peers ? 'bg-accent-soft text-accent' : 'bg-surface-3 text-muted',
            )}
          >
            {peers ? `En vivo · ${peers + 1}` : status === 'connecting' ? 'Conectando…' : 'Solo tú'}
          </span>
        )}
        <span className="flex-1" />
        {/* Who is on the whiteboard with you (team boards). */}
        {team && peers > 0 && (
          <span className="flex shrink-0 -space-x-1" aria-label="Personas en la pizarra">
            {Object.entries(peerList).map(([id, peer]) => (
              <span
                key={id}
                title={peer.name}
                className="grid size-6 place-items-center rounded-md text-[11px] text-white ring-2 ring-surface"
                style={{ background: peer.color }}
              >
                {peer.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
          </span>
        )}
        <IconButton
          icon={expanded ? 'shrink' : 'expand'}
          label={expanded ? 'Reducir pizarra' : 'Pantalla completa'}
          onClick={() => {
            useSketch.getState().toggleExpanded();
            animateLand(dialogRef.current);
          }}
        />
        <IconButton icon="close" label="Cerrar pizarra (Esc)" onClick={() => void close()} />
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col p-3">
        {model ? (
          <SketchSheet
            key={`${model.doc.guid}:${model.sheetId}`}
            ref={sheetRef}
            model={model}
            team={team}
          />
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-muted">
            {team ? 'Esperando la sesión del equipo…' : 'Preparando la pizarra…'}
          </div>
        )}
        {model && empty && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-sm text-faint">
            {team
              ? 'Todo el equipo dibuja aquí a la vez · L para señalar con el láser'
              : 'Dibuja con el ratón · clic derecho borra · arrastra una nota desde la barra'}
          </p>
        )}
      </div>

      {/* Dock: tools · colors · sizes · history. */}
      <div className="flex shrink-0 justify-center px-3 pb-3">
        <div
          role="toolbar"
          aria-label="Herramientas de la pizarra"
          className="flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-line-soft bg-card p-1.5 shadow-card"
        >
          {TOOLS.map((t) => (
            <button
              key={t.tool}
              type="button"
              aria-label={`${t.label} (${t.key.toUpperCase()})`}
              aria-pressed={tool === t.tool}
              onClick={(e) => pick(t.tool, e.currentTarget)}
              onPointerDown={t.tool === 'note' ? onNotePadDown : undefined}
              className={cx(
                'grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl transition-colors duration-100',
                tool === t.tool
                  ? 'bg-accent text-accent-ink shadow-card'
                  : 'text-muted hover:bg-surface-3 hover:text-ink',
              )}
            >
              <PixelIcon name={t.icon} />
            </button>
          ))}

          <span className="mx-1 h-6 w-px shrink-0 bg-line-soft" />

          {tool === 'note'
            ? NOTE_COLORS.map((c) => (
                <Swatch
                  key={c}
                  label={`Nota ${NOTE_NAMES[c]}`}
                  active={noteColor === c}
                  fill={`var(--note-${c})`}
                  onClick={() => useSketch.getState().setNoteColor(c)}
                />
              ))
            : INK_COLORS.map((c) => (
                <Swatch
                  key={c}
                  label={INK_NAMES[c]}
                  active={color === c && tool !== 'eraser'}
                  fill={`var(--sk-${c})`}
                  onClick={() => useSketch.getState().setColor(c)}
                />
              ))}

          <span className="mx-1 h-6 w-px shrink-0 bg-line-soft" />

          {([0, 1, 2] as const).map((step) => (
            <button
              key={step}
              type="button"
              aria-label={`Grosor ${['fino', 'medio', 'grueso'][step]} (${step === 0 ? '[' : step === 2 ? ']' : '[ ]'})`}
              aria-pressed={sizeStep === step}
              onClick={() => useSketch.getState().setSizeStep(step)}
              className={cx(
                'grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl',
                sizeStep === step ? 'bg-surface-3' : 'hover:bg-surface-3/70',
              )}
            >
              <span
                className="block"
                style={{
                  width: [4, 8, 13][step],
                  height: [4, 8, 13][step],
                  background: `var(--sk-${color})`,
                }}
              />
            </button>
          ))}

          <span className="mx-1 h-6 w-px shrink-0 bg-line-soft" />

          <IconButton
            icon="undo"
            label="Deshacer (Ctrl+Z)"
            disabled={!canUndo}
            onClick={() => model?.undo()}
          />
          <IconButton
            icon="redo"
            label="Rehacer (Ctrl+Shift+Z)"
            disabled={!canRedo}
            onClick={() => model?.redo()}
          />
          <IconButton
            icon="trash"
            label="Borrar toda la pizarra"
            disabled={empty}
            onClick={async () => {
              const ok = await confirm(
                team
                  ? '¿Borrar toda la pizarra? Se borra también para tu equipo (puedes deshacerlo).'
                  : '¿Borrar toda la pizarra? Puedes deshacerlo con Ctrl+Z.',
                { confirmLabel: 'Borrar', danger: true },
              );
              if (ok) model?.clear();
            }}
          />
        </div>
      </div>

      {ghost && (
        <div
          className="sk-ghost"
          style={
            {
              transform: `translate(${ghost.x - 8}px, ${ghost.y - 8}px) rotate(-4deg)`,
              '--note-bg': `var(--note-${noteColor})`,
            } as CSSProperties
          }
        />
      )}
    </dialog>
  );
}

function Swatch({
  label,
  active,
  fill,
  onClick,
}: {
  label: string;
  active: boolean;
  fill: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl hover:bg-surface-3/70"
    >
      <span
        className={cx(
          'block size-5 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] transition-transform duration-100',
          active && 'scale-110 outline-2 outline-offset-2 outline-accent',
        )}
        style={{ background: fill }}
      />
    </button>
  );
}
