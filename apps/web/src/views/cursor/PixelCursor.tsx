/**
 * Devbord's pixel cursor: the pointer as part of the app's identity.
 *
 * What it does on top of a normal cursor:
 *  - Pixel sprites that change with context: arrow, pointing hand, open hand
 *    over draggable cards, closed accent fist while dragging.
 *  - A soft highlight that morphs onto the hovered control (iPadOS-style),
 *    with a slight parallax toward the pointer.
 *  - Hints next to the cursor: the name of icon-only buttons, and the
 *    destination column while a card is dragged.
 *  - A tilt that follows horizontal speed, and a pixel spark burst on click.
 *
 * Performance: position, tilt and highlight are written to the DOM in a
 * requestAnimationFrame loop through refs. React state changes only when the
 * hovered target changes, never per mouse move.
 *
 * Only mounted for fine pointers (mouse / trackpad) and when the user has not
 * turned it off. Touch and keyboard use is unchanged.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PixelIcon, isMotionLite } from '../../design';
import { useCursorController } from '../../controllers/cursorController';
import { resolveCursor, type CursorTarget } from './resolveCursor';
import { RUNS, SCALE, SPRITES, type SpriteName } from './sprites';
import './cursor.css';

const FINE_POINTER = '(pointer: fine) and (hover: hover)';

const subscribeFine = (cb: () => void) => {
  const mq = window.matchMedia?.(FINE_POINTER);
  mq?.addEventListener?.('change', cb);
  return () => mq?.removeEventListener?.('change', cb);
};
const isFinePointer = () => window.matchMedia?.(FINE_POINTER).matches ?? false;

/** Mount point. Renders nothing on touch devices or when disabled. */
export function PixelCursor() {
  const enabled = useCursorController((s) => s.enabled);
  const fine = useSyncExternalStore(subscribeFine, isFinePointer, () => false);
  return enabled && fine ? <CursorLayer /> : null;
}

/** Hover hints wait a moment so they don't flash while the pointer travels. */
const HINT_DELAY_MS = 350;
const HALO_PAD = 4;
const MAX_TILT_DEG = 14;

function CursorLayer() {
  const layerRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  const [target, setTarget] = useState<CursorTarget>({
    variant: 'default',
    element: null,
    hint: null,
  });
  /** Hint revealed after the dwell delay, tied to the element it belongs to. */
  const [shownHint, setShownHint] = useState<{ el: Element; text: string } | null>(null);
  const dragging = useCursorController((s) => s.dragging);
  const dragHint = useCursorController((s) => s.hint);
  const draggingRef = useRef(dragging);
  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);

  // Mutable per-frame state lives in a ref (no re-render on mouse move).
  const live = useRef({ x: -100, y: -100, prevX: -100, tilt: 0, element: null as Element | null });
  useEffect(() => {
    // No highlight while dragging: the lifted card is the focus.
    live.current.element = dragging || target.variant !== 'pointer' ? null : target.element;
  }, [target.element, target.variant, dragging]);

  const sprite: SpriteName = dragging
    ? 'grabbing'
    : target.variant === 'text'
      ? 'default'
      : target.variant;
  const hotspot = SPRITES[sprite].hotspot;
  const hotspotRef = useRef(hotspot);
  useEffect(() => {
    hotspotRef.current = hotspot;
  }, [hotspot]);

  // Hide the system cursor while mounted.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.pixelCursor = '';
    return () => {
      delete root.dataset.pixelCursor;
    };
  }, []);

  // Enter the top layer, and re-enter whenever a modal <dialog> opens:
  // the last element shown in the top layer paints on top.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer?.showPopover) return;
    const raise = () => {
      if (layer.matches(':popover-open')) layer.hidePopover();
      layer.showPopover();
    };
    raise();
    const observer = new MutationObserver((records) => {
      if (records.some((r) => r.target instanceof HTMLDialogElement)) raise();
    });
    observer.observe(document.body, { subtree: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, []);

  // Pointer listeners + animation loop.
  useEffect(() => {
    const layer = layerRef.current!;
    let frame = 0;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      live.current.x = e.clientX;
      live.current.y = e.clientY;
      delete layer.dataset.hidden;
    };
    const onOver = (e: PointerEvent) => {
      const next = resolveCursor(e.target as Element);
      setTarget((prev) =>
        prev.variant === next.variant && prev.element === next.element && prev.hint === next.hint
          ? prev
          : next,
      );
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      layer.dataset.pressed = '';
      if (!isMotionLite()) burst(layer, e.clientX, e.clientY);
    };
    const onUp = () => delete layer.dataset.pressed;
    const onLeave = () => (layer.dataset.hidden = '');

    const tick = () => {
      const s = live.current;
      // Tilt follows horizontal speed and eases back when the pointer stops.
      const speed = s.x - s.prevX;
      s.prevX = s.x;
      const goal = isMotionLite()
        ? 0
        : Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, speed * 0.9));
      s.tilt += (goal - s.tilt) * 0.2;

      const [hx, hy] = hotspotRef.current;
      const sprite = spriteRef.current;
      if (sprite) {
        sprite.style.transformOrigin = `${hx * SCALE}px ${hy * SCALE}px`;
        sprite.style.transform = `translate3d(${s.x - hx * SCALE}px, ${s.y - hy * SCALE}px, 0) rotate(${s.tilt.toFixed(2)}deg)`;
      }

      const hint = hintRef.current;
      if (hint) {
        // Flip to the left of the pointer near the right edge so it never clips.
        const hx =
          s.x + 16 + hint.offsetWidth > window.innerWidth - 8
            ? s.x - hint.offsetWidth - 8
            : s.x + 16;
        // While dragging the card hangs below the hand: put the hint above it instead.
        const hy = draggingRef.current ? s.y - 34 : s.y + 22;
        hint.style.transform = `translate3d(${hx}px, ${hy}px, 0)`;
      }

      const halo = haloRef.current;
      if (halo) {
        if (s.element?.isConnected) {
          const r = s.element.getBoundingClientRect();
          // Parallax: the highlight leans a few px toward the pointer.
          const ox = ((s.x - (r.left + r.width / 2)) / Math.max(r.width, 1)) * 4;
          const oy = ((s.y - (r.top + r.height / 2)) / Math.max(r.height, 1)) * 4;
          halo.style.transform = `translate3d(${r.left - HALO_PAD + ox}px, ${r.top - HALO_PAD + oy}px, 0)`;
          halo.style.width = `${r.width + HALO_PAD * 2}px`;
          halo.style.height = `${r.height + HALO_PAD * 2}px`;
          halo.dataset.on = '';
        } else {
          halo.style.transform = `translate3d(${s.x - 6}px, ${s.y - 6}px, 0)`;
          halo.style.width = '12px';
          halo.style.height = '12px';
          delete halo.dataset.on;
        }
      }
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // Highlight shape follows the control's own corner radius.
  useEffect(() => {
    const el = target.element;
    const halo = haloRef.current;
    if (!el || !halo) return;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 6;
    halo.style.borderRadius = `${radius + HALO_PAD}px`;
  }, [target.element, dragging]);

  // Delayed hover hint. The native `title` tooltip is parked meanwhile so the
  // two do not stack; it is restored when the pointer leaves the control.
  useEffect(() => {
    const el = target.element;
    const title = el?.getAttribute('title');
    if (el && title) el.removeAttribute('title');
    const text = target.hint;
    const timer =
      el && text ? window.setTimeout(() => setShownHint({ el, text }), HINT_DELAY_MS) : 0;
    return () => {
      window.clearTimeout(timer);
      if (el && title) el.setAttribute('title', title);
    };
  }, [target]);

  const hoverHint = shownHint && shownHint.el === target.element ? shownHint.text : null;
  const hint = dragging ? dragHint : hoverHint;
  const hideSprite = target.variant === 'text' && !dragging;

  return (
    <div ref={layerRef} popover="manual" className="pc-layer" aria-hidden data-hidden="">
      <div ref={haloRef} className="pc-halo" />
      <div ref={spriteRef} className="pc-sprite" style={{ opacity: hideSprite ? 0 : 1 }}>
        <CursorSprite key={sprite} name={sprite} />
      </div>
      {hint && (
        <div
          ref={(el) => {
            hintRef.current = el;
            // Place it before first paint; the frame loop takes over afterwards.
            if (el)
              el.style.transform = `translate3d(${live.current.x + 16}px, ${live.current.y + (draggingRef.current ? -34 : 22)}px, 0)`;
          }}
          key={hint}
          className="pc-hint"
          data-drag={dragging ? '' : undefined}
        >
          {dragging && <PixelIcon name="board" size={12} />}
          {hint}
        </div>
      )}
    </div>
  );
}

/** Spawns 8 pixel sparks around (x, y); each removes itself when its animation ends. */
function burst(layer: HTMLElement, x: number, y: number) {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const spark = document.createElement('span');
    spark.className = 'pc-spark';
    spark.style.transform = `translate3d(${x - 2}px, ${y - 2}px, 0)`;
    spark.style.setProperty('--dx', `${Math.round(Math.cos(angle) * 14)}px`);
    spark.style.setProperty('--dy', `${Math.round(Math.sin(angle) * 14)}px`);
    spark.addEventListener('animationend', () => spark.remove(), { once: true });
    layer.appendChild(spark);
  }
}

/** Renders one sprite as an SVG of merged pixel runs (see sprites.ts). */
function CursorSprite({ name }: { name: SpriteName }) {
  const { grid } = SPRITES[name];
  const w = Math.max(...grid.map((r) => r.length));
  const h = grid.length;
  return (
    <svg
      width={w * SCALE}
      height={h * SCALE}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {RUNS[name].map(([x, y, width, fill], i) => (
        <rect key={i} x={x} y={y} width={width} height={1} fill={fill} />
      ))}
    </svg>
  );
}
