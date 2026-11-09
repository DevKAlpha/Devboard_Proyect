/**
 * A sticky note (or a free text) on the whiteboard.
 *
 * - Drag it by its top strip. It lifts, tilts with the movement like a real
 *   piece of paper, and lands with a squash. Teammates see it move live.
 * - Type straight into it. The text is saved as you type; the whole typing
 *   session is one undo step.
 * - Hover shows the color swatches and the delete button.
 */
import { memo, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  NOTE_COLORS,
  NOTE_TEXT_MAX,
  SHEET,
  type Note,
  type NoteColor,
  type SketchModel,
} from '../../controllers/sketchController';
import { useCollab } from '../../controllers/collabController';
import { PixelIcon, animateLand, animateOut, animateStick, cx } from '../../design';

const COLOR_NAMES: Record<NoteColor, string> = {
  yellow: 'amarillo',
  pink: 'rosa',
  blue: 'azul',
  green: 'verde',
};

/** Small, stable tilt per note (from its id): a wall of notes looks hand-placed. */
function restingTilt(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 5) - 2) * 0.8;
}

/** Live position updates for teammates while dragging (ms between writes). */
const SYNC_MS = 50;
const MAX_TILT = 8;

interface StickyNoteProps {
  note: Note;
  model: SketchModel;
  /** Sheet units → screen px. */
  scale: number;
  /** Just created on this screen: play the stick animation. */
  fresh: boolean;
  /** Put the caret in it on mount (a note you just placed). */
  autoFocus: boolean;
  team: boolean;
  /** Teammate typing in this note right now (team boards). */
  editor?: { name: string; color: string } | null;
}

export const StickyNote = memo(function StickyNote({
  note,
  model,
  scale,
  fresh,
  autoFocus,
  team,
  editor = null,
}: StickyNoteProps) {
  const paperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  /** Position while dragging (local, so the note follows the hand with no lag). */
  const [drag, setDrag] = useState<{ x: number; y: number; tilt: number } | null>(null);
  /** Text while the note has focus: remote echoes must not move the caret. */
  const [draft, setDraft] = useState<string | null>(null);
  const isText = note.kind === 'text';

  useEffect(() => {
    if (fresh) animateStick(paperRef.current);
    if (autoFocus) textRef.current?.focus();
    // Mount-only on purpose: these describe how the note arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as Element).closest('button')) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    model.stopCapturing();
    model.raiseNote(note.id);

    const start = { px: e.clientX, py: e.clientY, x: note.x, y: note.y };
    let last = { x: note.x, y: note.y, tilt: 0 };
    let prevX = e.clientX;
    let lastSync = 0;
    const clampX = (x: number) => Math.max(-40, Math.min(SHEET.width - 60, x));
    const clampY = (y: number) => Math.max(0, Math.min(SHEET.height - 40, y));

    const move = (ev: globalThis.PointerEvent) => {
      const x = clampX(start.x + (ev.clientX - start.px) / scale);
      const y = clampY(start.y + (ev.clientY - start.py) / scale);
      // The paper leans into the movement and straightens when it stops.
      const goal = Math.max(-MAX_TILT, Math.min(MAX_TILT, (ev.clientX - prevX) * 0.6));
      prevX = ev.clientX;
      last = { x, y, tilt: last.tilt + (goal - last.tilt) * 0.35 };
      setDrag(last);
      if (ev.timeStamp - lastSync > SYNC_MS) {
        lastSync = ev.timeStamp;
        model.updateNote(note.id, { x: Math.round(x), y: Math.round(y) });
      }
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      model.updateNote(note.id, { x: Math.round(last.x), y: Math.round(last.y) });
      setDrag(null);
      animateLand(paperRef.current);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    setDrag(last);
  };

  const x = drag?.x ?? note.x;
  const y = drag?.y ?? note.y;
  const tilt = drag ? drag.tilt : isText ? 0 : restingTilt(note.id);

  return (
    <div
      className="sk-note"
      data-kind={note.kind}
      data-dragging={drag ? '' : undefined}
      data-editor={editor ? '' : undefined}
      style={
        {
          transform: `translate(${x}px, ${y}px) rotate(${tilt}deg)${drag ? ' scale(1.04)' : ''}`,
          zIndex: drag ? 9999 : note.z,
          '--editor-color': editor?.color,
        } as CSSProperties
      }
      onPointerDown={() => model.raiseNote(note.id)}
    >
      {editor && <span className="sk-editor-tag">{editor.name} escribe…</span>}
      <div
        ref={paperRef}
        className="sk-paper"
        style={{ '--note-bg': `var(--note-${note.color})` } as CSSProperties}
      >
        <div
          className="sk-note-head"
          onPointerDown={startDrag}
          aria-roledescription="nota movible"
          data-cursor-hint="Arrastra para mover"
        >
          {team && note.author && !isText && (
            <span className="flex min-w-0 items-center gap-1.5 text-lg opacity-70">
              <span
                className="size-3 shrink-0"
                style={{ background: note.authorColor ?? 'currentColor' }}
              />
              <span className="truncate">{note.author}</span>
            </span>
          )}
          <div className="sk-note-tools">
            {!isText &&
              NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Nota ${COLOR_NAMES[c]}`}
                  aria-pressed={note.color === c}
                  onClick={() => model.updateNote(note.id, { color: c })}
                  className={cx(
                    'size-5 cursor-pointer shadow-[inset_0_0_0_1px_rgb(0_0_0/0.25)]',
                    note.color === c && 'outline-2 outline-offset-1 outline-black/40',
                  )}
                  style={{ background: `var(--note-${c})` }}
                />
              ))}
            <button
              type="button"
              aria-label={isText ? 'Borrar texto' : 'Despegar nota'}
              className="grid size-8 cursor-pointer place-items-center rounded opacity-60 hover:bg-black/10 hover:opacity-100"
              onClick={async () => {
                await animateOut(paperRef.current);
                model.removeNote(note.id);
              }}
            >
              <PixelIcon name="close" size={16} />
            </button>
          </div>
        </div>
        <textarea
          ref={textRef}
          aria-label={isText ? 'Texto en la pizarra' : 'Texto de la nota'}
          placeholder={isText ? 'Escribe…' : 'Escribe una observación…'}
          maxLength={NOTE_TEXT_MAX}
          rows={isText ? 1 : undefined}
          value={draft ?? note.text}
          onFocus={() => {
            if (team) useCollab.getState().setEditingNote(note.id);
            model.stopCapturing();
            setDraft(note.text);
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            model.updateNote(note.id, { text: e.target.value });
          }}
          onBlur={(e) => {
            setDraft(null);
            if (team) useCollab.getState().setEditingNote(null);
            // An empty free text is a misclick: do not leave invisible items behind.
            if (isText && !e.target.value.trim()) model.removeNote(note.id);
          }}
        />
      </div>
    </div>
  );
});
