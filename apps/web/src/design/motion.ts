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
 *  - Animations only touch `transform` and `opacity` (GPU-composited, no
 *    layout), and use the Web Animations API, so nothing blocks input.
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

/** Plays an exit animation, then resolves (instantly in lite mode or tests). */
export async function animateOut(el: Element | null | undefined): Promise<void> {
  if (!canAnimate(el)) return;
  await el
    .animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.86) translateY(6px) rotate(-2deg)' },
      ],
      { duration: 180, easing: PIXEL_STEPS, fill: 'forwards' },
    )
    .finished.catch(() => {});
}

/** Pop-in for things that just appeared (new card, new column, imported card). */
export function animateIn(el: Element | null | undefined) {
  if (!canAnimate(el)) return;
  el.animate(
    [
      { opacity: 0, transform: 'scale(0.85) translateY(-6px)' },
      { opacity: 1, transform: 'scale(1.03)', offset: 0.7 },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 260, easing: PIXEL_STEPS },
  );
}

/** Squash on landing after a drop. */
export function animateLand(el: Element | null | undefined) {
  if (!canAnimate(el)) return;
  el.animate(
    [
      { transform: 'scale(1.04, 0.94)' },
      { transform: 'scale(0.98, 1.03)', offset: 0.5 },
      { transform: 'none' },
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

/** Accent flash when an item changes (local edit or a teammate's). */
export function animateFlash(el: Element | null | undefined) {
  if (!canAnimate(el)) return;
  el.animate([{ boxShadow: '0 0 0 3px var(--accent)' }, { boxShadow: '0 0 0 3px transparent' }], {
    duration: 600,
    easing: 'steps(6, end)',
  });
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

/**
 * FLIP ("First, Last, Invert, Play"): animates every `[data-flip-id]` element
 * inside `container` from its previous position to the new one. Elements that
 * did not exist before pop in. Positions are measured in the container's
 * content space, so scrolling between renders never causes fake moves.
 *
 * Returns the new positions, to pass back on the next call.
 */
export function flip(
  container: HTMLElement,
  previous: Map<string, DOMRect>,
  options: { animate: boolean },
): Map<string, DOMRect> {
  const origin = container.getBoundingClientRect();
  const next = new Map<string, DOMRect>();
  const nodes = container.querySelectorAll<HTMLElement>('[data-flip-id]');
  nodes.forEach((node) => {
    const r = node.getBoundingClientRect();
    next.set(
      node.dataset.flipId!,
      new DOMRect(
        r.left - origin.left + container.scrollLeft,
        r.top - origin.top + container.scrollTop,
        r.width,
        r.height,
      ),
    );
  });

  if (options.animate && previous.size > 0 && !isMotionLite()) {
    // Nested items (cards inside a column) move with their parent: animate only
    // their own offset, or they would travel twice. Parents come first in DOM order.
    const deltas = new Map<Element, { dx: number; dy: number }>();
    nodes.forEach((node) => {
      const before = previous.get(node.dataset.flipId!);
      const after = next.get(node.dataset.flipId!)!;
      if (!before) {
        animateIn(node);
        return;
      }
      const parent = node.parentElement?.closest('[data-flip-id]');
      const inherited = (parent && deltas.get(parent)) || { dx: 0, dy: 0 };
      deltas.set(node, { dx: before.left - after.left, dy: before.top - after.top });
      const dx = before.left - after.left - inherited.dx;
      const dy = before.top - after.top - inherited.dy;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: 240,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      });
    });
  }
  return next;
}
