/**
 * Decides how the pixel cursor looks over a given element. Pure DOM reading,
 * no state, so it is unit-tested on its own.
 *
 * Rules, applied to the nearest matching ancestor (the closest element wins):
 *  1. `data-cursor="default|pointer|grab|text"` on any element overrides everything.
 *  2. Text fields → `text` (the native I-beam is kept: precise caret placement
 *     matters more than style there).
 *  3. Draggables (dnd-kit sets `aria-roledescription`) → `grab`.
 *  4. Enabled interactive elements → `pointer`, with a highlight around them.
 */
export type CursorVariant = 'default' | 'pointer' | 'grab' | 'text';

export interface CursorTarget {
  variant: CursorVariant;
  /** Element to highlight (pointer variant only). */
  element: Element | null;
  /** Label for icon-only controls, shown next to the cursor. */
  hint: string | null;
}

const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  'date',
]);

const INTERACTIVE =
  'a[href], button, select, summary, label[for], label:has(input), [role="button"], [role="tab"], [role="radio"], [role="link"]';

const isTextField = (el: Element) =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(el.type)) ||
  (el instanceof HTMLElement && el.isContentEditable);

const isDisabled = (el: Element) =>
  el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true';

/** Icon-only controls get their accessible name as a hint (replaces the slow native tooltip). */
const hintFor = (el: Element): string | null => {
  const label = el.getAttribute('aria-label');
  return label && !el.textContent?.trim() ? label : null;
};

const NONE: CursorTarget = { variant: 'default', element: null, hint: null };

export function resolveCursor(start: Element | null): CursorTarget {
  for (let el = start; el; el = el.parentElement) {
    const forced = el.getAttribute('data-cursor') as CursorVariant | null;
    if (forced) {
      return { variant: forced, element: forced === 'pointer' ? el : null, hint: hintFor(el) };
    }
    if (isTextField(el)) return { variant: 'text', element: null, hint: null };
    if (el.hasAttribute('aria-roledescription')) {
      return { variant: 'grab', element: null, hint: null };
    }
    if (el.matches(INTERACTIVE)) {
      return isDisabled(el) ? NONE : { variant: 'pointer', element: el, hint: hintFor(el) };
    }
  }
  return NONE;
}
