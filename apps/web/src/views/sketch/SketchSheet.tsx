/**
 * The whiteboard sheet: squared paper, a canvas for ink, and a scaled layer
 * for sticky notes and teammates' pens.
 *
 * Why it feels fluid with a mouse:
 *  - Pointer Events with pointer capture: a stroke keeps going even when the
 *    pointer leaves the sheet or crosses a note.
 *  - Coalesced events: every mouse sample the browser saw since the last
 *    frame is used, not just one per frame, so fast curves stay round.
 *  - Predicted events: the ink is drawn a few ms ahead of the pointer to hide
 *    the display latency (only on screen, never saved).
 *  - Lazy-brush smoothing + quadratic curves through midpoints: no jitter,
 *    no kinks, no visible lag.
 *  - A low-latency canvas (`desynchronized`) redrawn at most once per frame,
 *    with a Path2D cached per finished stroke.
 *  - The brush preview replaces the cursor: you see the exact width and color
 *    before touching the paper.
 *
 * Gestures: left button draws with the current tool; right button (or a pen's
 * eraser end) erases on the fly; Shift makes squares, circles and 45° arrows.
 */
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type Ref,
} from 'react';
import { newId } from '@devbord/shared';
import { useCollab } from '../../controllers/collabController';
import { useIdentity } from '../../controllers/identityController';
import {
  NOTE_SIZE,
  SHEET,
  SIZE_STEPS,
  useSketch,
  useSketchSnapshot,
  type InkColor,
  type Note,
  type SketchModel,
  type Stroke,
  type StrokeTool,
} from '../../controllers/sketchController';
import { useThemeController } from '../../controllers/themeController';
import { isMotionLite } from '../../design';
import { TintedArrow } from '../team/RemoteCursors';
import {
  constrainEnd,
  hitsStroke,
  isFreehand,
  paintedWidth,
  smoothTowards,
  snap,
  tracePath,
} from './geometry';
import { StickyNote } from './StickyNote';

/** Imperative API for the dock (dropping a note dragged from the pad). */
export interface SketchSheetHandle {
  /** Sheet coordinates of a screen point, or null when it is outside the sheet. */
  toSheet: (clientX: number, clientY: number) => { x: number; y: number } | null;
  placeNote: (kind: Note['kind'], x: number, y: number) => void;
}

const ASPECT = SHEET.width / SHEET.height;
const CELL = 40;
const ERASER_RADIUS = 14;
/** Minimum distance between stored samples (sheet units): fewer points, same look. */
const MIN_STEP = 1.2;
/** Freehand points are sent to the shared doc in batches (ms). */
const FLUSH_MS = 40;
/** A shape starts only after this much movement, so a click never leaves a dot-shape. */
const SHAPE_SLOP = 3;

interface LiveStroke {
  stroke: Stroke & { points: number[] };
  /** Not yet in the shared doc. */
  pending: number[];
  /** Smoothed pen position (lazy brush). */
  pos: { x: number; y: number };
  start: { x: number; y: number };
  /** Predicted tail, drawn but never stored. */
  predicted: number[];
  /** Shapes: created in the doc once the pointer really moved. */
  begun: boolean;
}

type Palette = Record<InkColor, string>;

function readPalette(el: Element): Palette {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim() || '#1d1d1f';
  return {
    ink: v('--sk-ink'),
    blue: v('--sk-blue'),
    red: v('--sk-red'),
    green: v('--sk-green'),
    orange: v('--sk-orange'),
    purple: v('--sk-purple'),
  };
}

export interface SketchSheetProps {
  /** Remount the sheet when the model changes (key={model}): state starts clean. */
  model: SketchModel;
  team: boolean;
  ref?: Ref<SketchSheetHandle>;
}

export function SketchSheet({ model, team, ref }: SketchSheetProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brushRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const scale = size.w / SHEET.width;

  const tool = useSketch((s) => s.tool);
  const color = useSketch((s) => s.color);
  const sizeStep = useSketch((s) => s.sizeStep);
  const noteColor = useSketch((s) => s.noteColor);
  const theme = useThemeController((s) => s.resolved);
  const snapshot = useSketchSnapshot();
  const peers = useCollab((s) => s.peers);

  // Mutable drawing state: read by the frame loop, never triggers renders.
  const live = useRef<LiveStroke | null>(null);
  const erasing = useRef(false);
  const strokesRef = useRef(snapshot.strokes);
  const paletteRef = useRef<Palette | null>(null);
  const paths = useRef(new WeakMap<Stroke, Path2D>());
  const frame = useRef(0);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Notes that exist when the sheet opens do not play the "stick" animation.
  const [known] = useState(() => new Set(model.getSnapshot().notes.map((n) => n.id)));
  const [focusId, setFocusId] = useState<string | null>(null);

  // --- fit the 16:10 sheet into the available space ---------------------------
  useLayoutEffect(() => {
    const frameEl = frameRef.current!;
    // Layout size (contentRect), not getBoundingClientRect: the dialog opens with
    // a scale animation, and a transformed size would leave the sheet too small.
    const fit = ([entry]: ResizeObserverEntry[]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const w = Math.floor(Math.min(width, height * ASPECT));
      setSize({ w, h: Math.floor(w / ASPECT) });
    };
    // The observer also fires once right away with the initial size.
    const observer = new ResizeObserver(fit);
    observer.observe(frameEl);
    return () => observer.disconnect();
  }, []);

  // --- painting --------------------------------------------------------------
  const paint = useCallback(() => {
    frame.current = 0;
    const canvas = canvasRef.current;
    // desynchronized: lower-latency canvas, ink appears closer to the pointer.
    const ctx = canvas?.getContext('2d', { desynchronized: true });
    if (!canvas || !ctx) return;
    const palette = (paletteRef.current ??= readPalette(sheetRef.current!));
    const k = canvas.width / SHEET.width;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const draw = (stroke: Stroke, path: Path2D) => {
      ctx.globalAlpha = stroke.tool === 'marker' ? 0.38 : 1;
      ctx.strokeStyle = palette[stroke.color];
      ctx.lineWidth = paintedWidth(stroke);
      ctx.stroke(path);
    };
    const current = live.current;
    for (const stroke of strokesRef.current) {
      if (current && stroke.id === current.stroke.id) continue; // drawn from the local copy
      let path = paths.current.get(stroke);
      if (!path) {
        path = new Path2D();
        tracePath(path, stroke);
        paths.current.set(stroke, path);
      }
      draw(stroke, path);
    }
    if (current && (current.begun || isFreehand(current.stroke.tool))) {
      const path = new Path2D();
      tracePath(path, {
        ...current.stroke,
        points: current.predicted.length
          ? [...current.stroke.points, ...current.predicted]
          : current.stroke.points,
      });
      draw(current.stroke, path);
    }
    ctx.globalAlpha = 1;
  }, []);

  const requestPaint = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  }, [paint]);

  useEffect(() => {
    strokesRef.current = snapshot.strokes;
    requestPaint();
  }, [snapshot.strokes, requestPaint]);

  // Crisp on HiDPI screens: the backing store follows devicePixelRatio.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    paint();
  }, [size, paint]);

  // Theme switch: ink colors are re-read from CSS.
  useEffect(() => {
    paletteRef.current = null;
    requestPaint();
  }, [theme, requestPaint]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  /** Picks up model changes right away (no flicker waiting for the React render). */
  const syncStrokes = () => {
    strokesRef.current = model.getSnapshot().strokes;
  };

  // --- notes -----------------------------------------------------------------
  const placeNote = useCallback(
    (kind: Note['kind'], x: number, y: number) => {
      const { name, color: authorColor } = useIdentity.getState();
      const id = newId();
      const w = kind === 'note' ? NOTE_SIZE.width : 160;
      model.addNote({
        id,
        kind,
        // Centered under the pointer (notes) or starting at it (text).
        x: Math.round(Math.max(0, Math.min(SHEET.width - w, kind === 'note' ? x - w / 2 : x))),
        y: Math.round(
          Math.max(
            0,
            Math.min(
              SHEET.height - (kind === 'note' ? NOTE_SIZE.height : 60),
              y - (kind === 'note' ? 20 : 26),
            ),
          ),
        ),
        text: '',
        color: useSketch.getState().noteColor,
        author: team ? name || 'Invitado' : null,
        authorColor: team ? authorColor : null,
      });
      setFocusId(id);
    },
    [model, team],
  );

  const toSheet = useCallback((clientX: number, clientY: number) => {
    const r = sheetRef.current?.getBoundingClientRect();
    if (!r || clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom)
      return null;
    return {
      x: ((clientX - r.left) / r.width) * SHEET.width,
      y: ((clientY - r.top) / r.height) * SHEET.height,
    };
  }, []);

  useImperativeHandle(ref, () => ({ toSheet, placeNote }), [toSheet, placeNote]);

  // --- pointer input -----------------------------------------------------------
  const pointOf = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * SHEET.width,
      y: ((e.clientY - r.top) / r.height) * SHEET.height,
    };
  };

  const moveBrush = (p: { x: number; y: number } | null) => {
    const brush = brushRef.current;
    if (!brush) return;
    if (!p) {
      delete brush.dataset.on;
      return;
    }
    const d = brush.offsetWidth;
    const h = brush.offsetHeight;
    brush.style.transform = `translate3d(${p.x * scale - d / 2}px, ${p.y * scale - h / 2}px, 0)`;
    brush.dataset.on = '';
  };

  const eraseAt = (p: { x: number; y: number }) => {
    const hit = new Set<string>();
    for (const s of strokesRef.current) if (hitsStroke(s, p.x, p.y, ERASER_RADIUS)) hit.add(s.id);
    if (hit.size) {
      model.removeStrokes(hit);
      syncStrokes();
      requestPaint();
      crumbs(sheetRef.current, p.x * scale, p.y * scale);
    }
  };

  const flush = () => {
    clearTimeout(flushTimer.current);
    flushTimer.current = undefined;
    const current = live.current;
    if (!current?.begun) return;
    if (isFreehand(current.stroke.tool)) {
      model.appendPoints(current.stroke.id, current.pending);
      current.pending = [];
    } else {
      model.setPoints(current.stroke.id, current.stroke.points);
    }
  };
  const flushSoon = () => {
    flushTimer.current ??= setTimeout(flush, FLUSH_MS);
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const eraseButton = e.button === 2 || (e.buttons & 32) !== 0;
    if (e.pointerType === 'mouse' && e.button !== 0 && !eraseButton) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Typing in a note and clicking the paper only leaves the note (no stray ink).
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement) {
      active.blur();
      return;
    }
    const p = pointOf(e);

    if (tool === 'eraser' || eraseButton) {
      erasing.current = true;
      model.stopCapturing();
      eraseAt(p);
      return;
    }
    if (tool === 'note' || tool === 'text') {
      placeNote(tool, p.x, p.y);
      return;
    }
    const strokeTool: StrokeTool = tool;
    const x = snap(p.x);
    const y = snap(p.y);
    const freehand = isFreehand(strokeTool);
    const stroke = {
      id: newId(),
      tool: strokeTool,
      color,
      size: SIZE_STEPS[sizeStep],
      points: freehand ? [x, y] : [x, y, x, y],
    };
    live.current = {
      stroke,
      pending: [],
      pos: p,
      start: { x, y },
      predicted: [],
      begun: freehand,
    };
    if (freehand) model.beginStroke(stroke);
    requestPaint();
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = pointOf(e);
    moveBrush(p);
    if (team) useCollab.getState().setPen({ x: Math.round(p.x), y: Math.round(p.y) });

    if (erasing.current) {
      for (const ev of e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent])
        eraseAt(pointOf(ev));
      return;
    }
    const current = live.current;
    if (!current) return;

    if (isFreehand(current.stroke.tool)) {
      // A stylus is already precise: smooth it less than a mouse.
      const amount = e.pointerType === 'pen' ? 0.2 : current.stroke.tool === 'marker' ? 0.5 : 0.4;
      const pts = current.stroke.points;
      for (const ev of e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]) {
        current.pos = smoothTowards(current.pos, pointOf(ev), amount);
        const x = snap(current.pos.x);
        const y = snap(current.pos.y);
        const lx = pts[pts.length - 2]!;
        const ly = pts[pts.length - 1]!;
        if (Math.hypot(x - lx, y - ly) < MIN_STEP) continue;
        pts.push(x, y);
        current.pending.push(x, y);
      }
      const predicted = e.nativeEvent.getPredictedEvents?.() ?? [];
      const last = predicted[predicted.length - 1];
      current.predicted = last ? (({ x, y }) => [x, y])(pointOf(last)) : [];
    } else {
      let end = { x: p.x, y: p.y };
      if (e.shiftKey)
        end = constrainEnd(current.stroke.tool, current.start.x, current.start.y, p.x, p.y);
      if (!current.begun) {
        if (Math.hypot(end.x - current.start.x, end.y - current.start.y) < SHAPE_SLOP) return;
        current.begun = true;
        model.beginStroke(current.stroke);
      }
      current.stroke.points = [current.start.x, current.start.y, snap(end.x), snap(end.y)];
    }
    flushSoon();
    requestPaint();
  };

  const finish = (e: PointerEvent<HTMLCanvasElement>) => {
    erasing.current = false;
    const current = live.current;
    if (!current) return;
    if (isFreehand(current.stroke.tool)) {
      // Let the ink catch up with the pointer exactly where it was released.
      const p = pointOf(e);
      const pts = current.stroke.points;
      if (pts.length > 2 || Math.hypot(p.x - pts[0]!, p.y - pts[1]!) > MIN_STEP) {
        current.stroke.points.push(snap(p.x), snap(p.y));
        current.pending.push(snap(p.x), snap(p.y));
      }
    }
    flush();
    if (current.begun) model.endStroke(current.stroke.id);
    live.current = null;
    syncStrokes();
    requestPaint();
  };

  const onPointerLeave = () => {
    moveBrush(null);
    if (team) useCollab.getState().setPen(null);
  };

  // --- brush preview look ------------------------------------------------------
  const width = SIZE_STEPS[sizeStep] * (tool === 'marker' ? 3 : 1);
  const brushKind =
    tool === 'eraser' ? 'eraser' : tool === 'note' ? 'note' : tool === 'text' ? 'text' : 'draw';
  const brushPx =
    brushKind === 'eraser'
      ? ERASER_RADIUS * 2 * scale
      : brushKind === 'note'
        ? NOTE_SIZE.width * scale * 0.5
        : brushKind === 'text'
          ? 30 * scale
          : Math.max(6, width * scale);

  return (
    <div ref={frameRef} className="grid min-h-0 flex-1 place-items-center">
      <div
        ref={sheetRef}
        className="sk-sheet"
        data-cursor="none"
        style={
          {
            width: size.w,
            height: size.h,
            '--sk-cell': `${CELL * scale}px`,
          } as CSSProperties
        }
      >
        <canvas
          ref={canvasRef}
          className="sk-canvas"
          aria-label="Pizarra: dibuja con el ratón"
          role="img"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          onPointerLeave={onPointerLeave}
          onContextMenu={(e) => e.preventDefault()}
        />
        <div
          ref={brushRef}
          className="sk-brush"
          data-kind={brushKind}
          style={
            {
              width: brushPx,
              height:
                brushKind === 'note' ? brushPx * (NOTE_SIZE.height / NOTE_SIZE.width) : brushPx,
              '--sk-color': `var(--sk-${color})`,
              '--note-bg': `var(--note-${noteColor})`,
            } as CSSProperties
          }
        />
        <div
          className="sk-layer"
          style={{ width: SHEET.width, height: SHEET.height, transform: `scale(${scale})` }}
        >
          {snapshot.notes.map((note) => (
            <StickyNote
              key={note.id}
              note={note}
              model={model}
              scale={scale}
              fresh={!known.has(note.id)}
              autoFocus={note.id === focusId}
              team={team}
            />
          ))}
          {team &&
            Object.entries(peers).map(([id, peer]) =>
              peer.pen ? (
                <div
                  key={id}
                  className="sk-peer"
                  style={{ transform: `translate(${peer.pen.x}px, ${peer.pen.y}px)` }}
                >
                  <div
                    style={{
                      transform: `scale(${1 / Math.max(scale, 0.01)})`,
                      transformOrigin: '0 0',
                    }}
                  >
                    <TintedArrow color={peer.color} />
                    <span
                      className="mt-0.5 ml-3 inline-block rounded-md px-1.5 py-0.5 text-[11px] whitespace-nowrap text-white shadow-card"
                      style={{ background: peer.color }}
                    >
                      {peer.name}
                    </span>
                  </div>
                </div>
              ) : null,
            )}
        </div>
      </div>
    </div>
  );
}

/** A few pixels flying off where ink was rubbed out. */
function crumbs(sheet: HTMLElement | null, x: number, y: number) {
  if (!sheet || isMotionLite()) return;
  for (let i = 0; i < 3; i++) {
    const el = document.createElement('span');
    el.className = 'sk-crumb';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    sheet.appendChild(el);
    const a = Math.random() * Math.PI * 2;
    const d = 10 + Math.random() * 14;
    el.animate(
      [
        { transform: 'translate(-2px, -2px)', opacity: 0.9 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 8}px)`, opacity: 0 },
      ],
      { duration: 320, easing: 'steps(4, end)' },
    ).onfinish = () => el.remove();
  }
}
