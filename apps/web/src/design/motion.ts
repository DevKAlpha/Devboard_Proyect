/**
 * Motion system: one place decides how much animation the device gets.
 *
 * `<html data-motion="full|lite">`
 *  - lite on modest devices (≤ 2 CPU cores, ≤ 2 GB RAM, or data saver on), or
 *    when the user turns animations down from the top bar (remembered).
 *    Lite keeps every state visible (cobwebs, frost…) but drops decorative
 *    loops, so the app stays smooth on any hardware.
 *  - The OS "reduce motion" setting does NOT turn animations off: product
 *    decision, the animations are part of how the board communicates. They are
 *    short, small and never flash.
 *  - Animations only touch `transform`, `opacity` and `clip-path` (no layout),
 *    and use the Web Animations API, so nothing blocks input.
 *  - One look for every effect: stepped timing (sprite frames), hard pixels, and
 *    always INSIDE the element's own box. Card lists scroll, so anything that
 *    grows past a card (scale-ups, glows, blurred shadows) would be cut by the
 *    list edge; effects reveal, blink or sparkle within the card instead.
 */

type NavigatorHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

function modestDevice(): boolean {
  const nav = navigator as NavigatorHints;
  return (
    (nav.hardwareConcurrency ?? 8) <= 2 ||
    (nav.deviceMemory ?? 8) <= 2 ||
    nav.connection?.saveData === true
  );
}

const MOTION_STORAGE_KEY = 'devbord:motion';

/** The user's explicit choice, or null to follow the device. */
function storedMotion(): 'lite' | 'full' | null {
  try {
    const value = localStorage.getItem(MOTION_STORAGE_KEY);
    return value === 'lite' || value === 'full' ? value : null;
  } catch {
    return null;
  }
}

/** Sets `data-motion` on <html> once: the user's choice, else the device capabilities. */
export function initMotion() {
  document.documentElement.dataset.motion = storedMotion() ?? (modestDevice() ? 'lite' : 'full');
}

/** The top bar switch: forces lite (or full) motion and remembers it. */
export function setMotionLite(lite: boolean) {
  const level = lite ? 'lite' : 'full';
  document.documentElement.dataset.motion = level;
  try {
    localStorage.setItem(MOTION_STORAGE_KEY, level);
  } catch {
    /* non-fatal: the choice lasts for this session only */
  }
}

/** True when animations should be minimal (see initMotion). */
export const isMotionLite = () => document.documentElement.dataset.motion === 'lite';

const canAnimate = (el: Element | null | undefined): el is HTMLElement =>
  !!el && typeof (el as HTMLElement).animate === 'function' && !isMotionLite();

/** Pixel-style ease: a few discrete steps, like sprite frames. */
export const PIXEL_STEPS = 'steps(5, end)';

/**
 * A throwaway layer over `el` for pixel effects: same box, clipped to it, gone
 * when the effect ends. `el` must be positioned (cards and columns are).
 */
function fxLayer(el: HTMLElement, ms: number): HTMLElement {
  const layer = document.createElement('span');
  layer.setAttribute('aria-hidden', 'true');
  // Inline styles on purpose: columns force `position: relative` on children.
  Object.assign(layer.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'hidden',
    borderRadius: 'inherit',
    pointerEvents: 'none',
    zIndex: '4',
  });
  el.appendChild(layer);
  window.setTimeout(() => layer.remove(), ms);
  return layer;
}

/** Plays an exit animation, then resolves (instantly in lite mode or tests). */
export async function animateOut(el: Element | null | undefined): Promise<void> {
  if (!canAnimate(el)) return;
  // Switched off like an old screen: it folds to a line in the middle of its own box.
  await el
    .animate(
      [
        { opacity: 1, clipPath: 'inset(0 0 0 0)' },
        { opacity: 1, clipPath: 'inset(45% 0 45% 0)', offset: 0.7 },
        { opacity: 0, clipPath: 'inset(50% 0 50% 0)' },
      ],
      { duration: 200, easing: PIXEL_STEPS, fill: 'forwards' },
    )
    .finished.catch(() => {});
}

/** Entrance for things that just appeared: drawn top to bottom in a few bands, like a sprite. */
export function animateIn(el: Element | null | undefined) {
  if (!canAnimate(el)) return;
  el.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }], {
    duration: 240,
    easing: 'steps(6, end)',
  });
}

/**
 * A few pixels sparkle up and fade, inside the element (new card, card done).
 * Colors default to the accent and the skin's second spark color.
 */
export function pixelBurst(
  el: Element | null | undefined,
  colors: readonly string[] = ['var(--accent)', 'var(--skin-spark-2, #ffd84a)'],
) {
  if (!canAnimate(el)) return;
  const { width, height } = el.getBoundingClientRect();
  if (width < 12 || height < 12) return;
  const layer = fxLayer(el, 900);
  for (let i = 0; i < 12; i++) {
    const dot = document.createElement('span');
    Object.assign(dot.style, {
      position: 'absolute',
      left: `${Math.round(4 + Math.random() * (width - 10))}px`,
      top: `${Math.round(8 + Math.random() * (height - 12))}px`,
      width: '3px',
      height: '3px',
      background: colors[i % colors.length]!,
    });
    layer.appendChild(dot);
    dot.animate(
      [
        { opacity: 0, transform: 'translateY(0)' },
        { opacity: 1, transform: 'translateY(-3px)', offset: 0.3 },
        { opacity: 0, transform: 'translateY(-9px)' },
      ],
      { duration: 480, delay: i * 30, easing: 'steps(4, end)', fill: 'both' },
    );
  }
}

/** Squash on landing after a drop (vertical only, so it never pokes out sideways). */
export function animateLand(el: Element | null | undefined) {
  if (!canAnimate(el)) return;
  el.animate(
    [
      { transform: 'scaleY(0.94)', transformOrigin: '50% 100%' },
      { transform: 'scaleY(1.02)', transformOrigin: '50% 100%', offset: 0.5 },
      { transform: 'none', transformOrigin: '50% 100%' },
    ],
    { duration: 220, easing: 'steps(4, end)' },
  );
}

/** A sticky note slapped onto the board: drops in, squashes, settles. */
export function animateStick(el: Element | null | undefined) {
  if (!canAnimate(el)) return;
  el.animate(
    [
      { opacity: 0, transform: 'translateY(-18px) scale(1.12) rotate(5deg)' },
      { opacity: 1, transform: 'translateY(2px) scale(1.03, 0.95)', offset: 0.6 },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 300, easing: 'steps(6, end)' },
  );
}

/** Accent blink when an item changes (local edit or a teammate's): a pixel ring inside its border. */
export function animateFlash(el: Element | null | undefined) {
  if (!canAnimate(el)) return;
  const ring = fxLayer(el, 600);
  ring.style.boxShadow = 'inset 0 0 0 2px var(--accent)';
  const hold = 'steps(1, end)';
  ring.animate(
    [
      { opacity: 1, easing: hold },
      { opacity: 0, easing: hold },
      { opacity: 1, easing: hold },
      { opacity: 0 },
    ],
    { duration: 480, fill: 'forwards' },
  );
}

/** Short horizontal shake (e.g. a column going over its WIP limit). */
export function animateShake(el: Element | null | undefined) {
  if (!canAnimate(el)) return;
  el.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-3px)' },
      { transform: 'translateX(3px)' },
      { transform: 'translateX(-2px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 280, easing: 'steps(5, end)' },
  );
}

/** Where each `[data-flip-id]` element was, and inside which flip parent (column). */
export type FlipPositions = Map<string, { rect: DOMRect; parent: string | null }>;

/**
 * FLIP ("First, Last, Invert, Play"): animates every `[data-flip-id]` element
 * inside `container` from its previous position to the new one. Elements that
 * did not exist before are drawn in (with a pixel sparkle for cards and
 * columns). Positions are measured in the container's content space, so
 * scrolling between renders never causes fake moves.
 *
 * An element that changed parent (a card moved to another column) does not
 * glide across: its new column clips it, so it would show cut in half on the
 * way. It lands in place instead.
 *
 * Returns the new positions, to pass back on the next call.
 */
export function flip(
  container: HTMLElement,
  previous: FlipPositions,
  options: { animate: boolean },
): FlipPositions {
  const origin = container.getBoundingClientRect();
  const next: FlipPositions = new Map();
  const nodes = container.querySelectorAll<HTMLElement>('[data-flip-id]');
  const parentOf = (node: HTMLElement) =>
    node.parentElement?.closest<HTMLElement>('[data-flip-id]')?.dataset.flipId ?? null;
  nodes.forEach((node) => {
    const r = node.getBoundingClientRect();
    next.set(node.dataset.flipId!, {
      rect: new DOMRect(
        r.left - origin.left + container.scrollLeft,
        r.top - origin.top + container.scrollTop,
        r.width,
        r.height,
      ),
      parent: parentOf(node),
    });
  });

  if (options.animate && previous.size > 0 && !isMotionLite()) {
    // Nested items (cards inside a column) move with their parent: animate only
    // their own offset, or they would travel twice. Parents come first in DOM order.
    const deltas = new Map<Element, { dx: number; dy: number }>();
    nodes.forEach((node) => {
      const was = previous.get(node.dataset.flipId!);
      const now = next.get(node.dataset.flipId!)!;
      if (!was) {
        animateIn(node);
        pixelBurst(node.matches('.kb-col') ? node : node.querySelector('.kb-card'));
        return;
      }
      if (was.parent !== now.parent) {
        animateLand(node.firstElementChild);
        return;
      }
      const before = was.rect;
      const after = now.rect;
      const parent = node.parentElement?.closest('[data-flip-id]');
      const inherited = (parent && deltas.get(parent)) || { dx: 0, dy: 0 };
      deltas.set(node, { dx: before.left - after.left, dy: before.top - after.top });
      const dx = before.left - after.left - inherited.dx;
      const dy = before.top - after.top - inherited.dy;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: 240,
        easing: 'steps(6, end)',
      });
    });
  }
  return next;
}
