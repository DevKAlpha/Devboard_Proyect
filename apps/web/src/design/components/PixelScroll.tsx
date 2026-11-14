/**
 * Scroll area with a pixel scrollbar drawn in the DOM.
 *
 * The native scrollbar is hidden: the OS paints it outside the page, so it
 * cannot take the app's look and the system arrow replaces the pixel cursor
 * over it. This one is a plain element, so the pixel cursor stays and the
 * thumb moves in 2px steps like a sprite. Wheel, touch and keyboard scrolling
 * still use the native scroller underneath.
 */
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { cx } from '../cx';

/** Gap between the track ends and the frame (px). */
const PAD = 4;
/** Shortest thumb, so it stays easy to grab on long content (px). */
const MIN_THUMB = 24;
/** Pixel grid of the thumb's movement (px). */
const STEP = 2;

const snap = (n: number) => Math.round(n / STEP) * STEP;

export interface PixelScrollProps {
  children: ReactNode;
  /** Classes of the scrolling viewport (padding, max height...). */
  className?: string;
}

export function PixelScroll({ children, className }: PixelScrollProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);

  const update = useCallback(() => {
    const v = viewport.current;
    if (!v) return;
    const overflow = v.scrollHeight - v.clientHeight;
    if (overflow <= 1) {
      setThumb(null);
      return;
    }
    const track = v.clientHeight - PAD * 2;
    const height = snap(Math.max(MIN_THUMB, (track * v.clientHeight) / v.scrollHeight));
    const top = PAD + snap(((track - height) * v.scrollTop) / overflow);
    setThumb((t) => (t && t.top === top && t.height === height ? t : { top, height }));
  }, []);

  useLayoutEffect(() => {
    const v = viewport.current;
    if (!v) return;
    update();
    // Content grows or shrinks (sections open, images load): re-measure.
    // (jsdom has no ResizeObserver: tests just skip the re-measuring.)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(v);
    for (const child of v.children) ro?.observe(child);
    v.addEventListener('scroll', update, { passive: true });
    return () => {
      ro?.disconnect();
      v.removeEventListener('scroll', update);
    };
  }, [update]);

  /** Dragging the thumb scrolls proportionally; the pointer is captured until release. */
  const onThumbDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const v = viewport.current;
    if (!v || !thumb) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startScroll = v.scrollTop;
    const ratio = (v.scrollHeight - v.clientHeight) / (v.clientHeight - PAD * 2 - thumb.height);
    const move = (ev: PointerEvent) => {
      v.scrollTop = startScroll + (ev.clientY - startY) * ratio;
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  /** A click on the track pages towards it, like a native scrollbar. */
  const onTrackDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const v = viewport.current;
    if (!v || !thumb) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    v.scrollBy({ top: (y < thumb.top ? -1 : 1) * v.clientHeight * 0.9 });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={viewport} className={cx('pixel-scroll min-h-0 flex-1 overflow-y-auto', className)}>
        {children}
      </div>
      {thumb && (
        <div aria-hidden className="pixel-scroll-track" onPointerDown={onTrackDown}>
          <div
            className="pixel-scroll-thumb"
            style={{ top: thumb.top, height: thumb.height }}
            onPointerDown={onThumbDown}
          />
        </div>
      )}
    </div>
  );
}
