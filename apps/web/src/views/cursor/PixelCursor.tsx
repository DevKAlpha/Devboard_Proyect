/**
 * Devbord's pixel cursor: the pointer as part of the app's identity.
 *
 * The cursor itself is the browser's own (CSS `cursor: url(...)`), drawn from
 * the pixel sprites in sprites.ts: arrow, pointing hand, open hand over
 * draggable cards, closed fist while dragging. The system draws it, so it
 * follows the mouse with no delay and costs no JavaScript per move. (A sprite
 * moved from JS always trails the real pointer by a frame or two, and that lag
 * made the whole app feel slow.)
 *
 * On top, a click-through layer adds what CSS cannot:
 *  - A pixel selection (corner brackets) on the hovered control.
 *  - Hints next to the cursor: the name of icon-only buttons, and the
 *    destination column while a card is dragged.
 *  - A pixel spark burst on click.
 *
 * Performance: React state changes only when the hovered target changes. The
 * selection follows its control in a requestAnimationFrame loop that runs only
 * while a control is highlighted, and writes to the DOM only when it moved.
 *
 * Only mounted for fine pointers (mouse / trackpad). Touch is unchanged.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { PixelIcon, isMotionLite, skinHatRects } from '../../design';
import { useCursorController } from '../../controllers/cursorController';
import { useThemeController } from '../../controllers/themeController';
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

/** System cursor used where the pixel one cannot load. */
const FALLBACK: Record<SpriteName, string> = {
  default: 'default',
  pointer: 'pointer',
  grab: 'grab',
  grabbing: 'grabbing',
};

/** Seasonal skins dress the cursor with their hat (sprite cells above the arrow). */
const HATS = { halloween: 'witchHat', christmas: 'santaHat' } as const;
const HAT_W = 12;
const HAT_H = 7; // rows of the hat above the sprite; the rest overlaps its tip
const HAT_X = 3;

/**
 * One sprite as a CSS cursor value: an SVG data URL with its hotspot. Colors
 * are resolved here (a cursor image cannot read CSS variables).
 */
function cursorValue(
  name: SpriteName,
  colors: Record<string, string>,
  hat: (typeof HATS)[keyof typeof HATS] | null,
) {
  const { grid, hotspot } = SPRITES[name];
  const top = hat ? HAT_H : 0;
  const w = Math.max(...grid.map((r) => r.length), hat ? HAT_X + HAT_W : 0);
  const h = grid.length + top;
  const rects = RUNS[name]
    .map(([x, y, width, fill]) => {
      const color = colors[fill] ?? fill;
      return `<rect x="${x}" y="${y + top}" width="${width}" height="1" fill="${color}"/>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * SCALE}" height="${h * SCALE}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}${hat ? skinHatRects(hat, HAT_X, 0) : ''}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspot[0] * SCALE} ${(hotspot[1] + top) * SCALE}, ${FALLBACK[name]}`;
}

/** Ancestors that cut what overflows them: the selection must not leave them. */
function clippingAncestors(el: Element): Element[] {
  const out: Element[] = [];
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.clipPath !== 'none') {
      out.push(p);
    }
  }
  return out;
}

/** The visible part of `el`, in whole pixels, or null when none of it shows. */
function visibleBox(el: Element, clips: Element[]) {
  const r = el.getBoundingClientRect();
  let left = r.left;
  let top = r.top;
  let right = r.right;
  let bottom = r.bottom;
  for (const c of clips) {
    const k = c.getBoundingClientRect();
    left = Math.max(left, k.left);
    top = Math.max(top, k.top);
    right = Math.min(right, k.right);
    bottom = Math.min(bottom, k.bottom);
  }
  left = Math.round(left);
  top = Math.round(top);
  const width = Math.round(right) - left;
  const height = Math.round(bottom) - top;
  // Too small to frame (a sliver at the edge of a scrolling list).
  return width < 8 || height < 8 ? null : { left, top, width, height };
}

/** Mount point. Always on with a mouse or trackpad; renders nothing on touch devices. */
export function PixelCursor() {
  const fine = useSyncExternalStore(subscribeFine, isFinePointer, () => false);
  return fine ? <CursorLayer /> : null;
}

/** Hover hints wait a moment so they don't flash while the pointer travels. */
const HINT_DELAY_MS = 350;

function CursorLayer() {
  const layerRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement | null>(null);
  /** Pointer position and the hint's width (read once per hint, not per move). */
  const live = useRef({ x: -100, y: -100, hintWidth: 0 });

  const [target, setTarget] = useState<CursorTarget>({
    variant: 'default',
    element: null,
    hint: null,
    owner: null,
  });
  /** Hint revealed after the dwell delay, tied to the element it belongs to. */
  const [shownHint, setShownHint] = useState<{ el: Element; text: string } | null>(null);
  const dragging = useCursorController((s) => s.dragging);
  const dragHint = useCursorController((s) => s.hint);
  const draggingRef = useRef(dragging);
  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);
  // Sprite colors follow the theme and the board skin.
  const skin = useThemeController((s) => s.skin);
  const look = useThemeController((s) => `${s.skin}:${s.resolved}`);

  // Switch the page to the pixel cursors (cursor.css picks one per element).
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.pixelCursor = '';
    return () => {
      delete root.dataset.pixelCursor;
    };
  }, []);

  // Build the cursor images with the colors on screen now.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const colors: Record<string, string> = {
      'var(--cursor-outline)': cs.getPropertyValue('--cursor-outline').trim() || '#141416',
      'var(--cursor-fill)': cs.getPropertyValue('--cursor-fill').trim() || '#ffffff',
      'var(--accent)': cs.getPropertyValue('--accent').trim() || '#5e5ce6',
    };
    const hat = skin in HATS ? HATS[skin as keyof typeof HATS] : null;
    for (const name of Object.keys(SPRITES) as SpriteName[]) {
      root.style.setProperty(`--pc-${name}`, cursorValue(name, colors, hat));
    }
  }, [look, skin]);

  // Closed fist everywhere while a card is carried.
  useEffect(() => {
    const root = document.documentElement;
    if (dragging) root.dataset.pcDragging = '';
    else delete root.dataset.pcDragging;
    return () => {
      delete root.dataset.pcDragging;
    };
  }, [dragging]);

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

  // Pointer listeners: no work per move except placing a visible hint.
  useEffect(() => {
    const layer = layerRef.current!;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      live.current.x = e.clientX;
      live.current.y = e.clientY;
      if ('hidden' in layer.dataset) delete layer.dataset.hidden;
      if (hintRef.current) placeHint(hintRef.current, live.current, draggingRef.current);
    };
    const onOver = (e: PointerEvent) => {
      const next = resolveCursor(e.target as Element);
      setTarget((prev) =>
        prev.variant === next.variant &&
        prev.element === next.element &&
        prev.hint === next.hint &&
        prev.owner === next.owner
          ? prev
          : next,
      );
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      // No sparks where a view draws its own cursor (they would cover the ink).
      if (resolveCursor(e.target as Element).variant === 'none') return;
      if (!isMotionLite()) burst(layer, e.clientX, e.clientY);
    };
    const onLeave = () => (layer.dataset.hidden = '');

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // The cursor of the hovered control: only its owner element is marked, and
  // its subtree inherits (cheap: no page-wide selector re-matches on hover).
  useEffect(() => {
    const { owner, variant } = target;
    // While dragging, the fist on <html> shows everywhere.
    if (!owner || dragging) return;
    owner.setAttribute('data-pc', variant);
    return () => owner.removeAttribute('data-pc');
  }, [target, dragging]);

  // The selection: on the hovered control while it is highlighted, else off.
  // No highlight while dragging: the lifted card is the focus.
  const selected = !dragging && target.variant === 'pointer' ? target.element : null;
  useEffect(() => {
    const halo = haloRef.current;
    if (!halo) return;
    if (!selected) {
      delete halo.dataset.on;
      return;
    }
    const clips = clippingAncestors(selected);
    let last = '';
    let frame = 0;
    // Follows the control (it can scroll or move), writing only on change.
    const place = () => {
      const box = selected.isConnected ? visibleBox(selected, clips) : null;
      const key = box ? `${box.left},${box.top},${box.width},${box.height}` : '';
      if (key !== last) {
        last = key;
        if (box) {
          halo.style.transform = `translate3d(${box.left}px, ${box.top}px, 0)`;
          halo.style.width = `${box.width}px`;
          halo.style.height = `${box.height}px`;
          halo.dataset.on = '';
        } else {
          delete halo.dataset.on;
        }
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [selected]);

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

  // Stable ref: a new function each render made React detach and re-attach it,
  // and every attach read offsetWidth (a forced layout) on each render.
  const attachHint = useCallback((el: HTMLDivElement | null) => {
    hintRef.current = el;
    // Measure once, then place it before first paint; moves take over afterwards.
    if (el) {
      live.current.hintWidth = el.offsetWidth;
      placeHint(el, live.current, draggingRef.current);
    }
  }, []);

  const hoverHint = shownHint && shownHint.el === target.element ? shownHint.text : null;
  const hint = dragging ? dragHint : hoverHint;

  return (
    <div ref={layerRef} popover="manual" className="pc-layer" aria-hidden data-hidden="">
      <div ref={haloRef} className="pc-halo" />
      {hint && (
        <div
          ref={attachHint}
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

/** Puts the hint next to the pointer; it flips left near the right edge so it never clips. */
function placeHint(
  hint: HTMLElement,
  p: { x: number; y: number; hintWidth: number },
  dragging: boolean,
) {
  const x = p.x + 16 + p.hintWidth > window.innerWidth - 8 ? p.x - p.hintWidth - 8 : p.x + 16;
  // While dragging the card hangs below the hand: put the hint above it instead.
  const y = dragging ? p.y - 34 : p.y + 22;
  // The translate property (not transform): the pop animation scales the hint
  // in place, without scaling its position too.
  hint.style.translate = `${x}px ${y}px`;
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
