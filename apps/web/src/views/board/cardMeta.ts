/** Display metadata (wording + color) for card enums. Pure presentation. */
import type { CardType, LabelColor, Priority } from '@devbord/shared';

export const CARD_TYPE_META: Record<CardType, { label: string; color: LabelColor }> = {
  task: { label: 'Tarea', color: 'gray' },
  feature: { label: 'Feature', color: 'purple' },
  bug: { label: 'Bug', color: 'red' },
};

export const PRIORITY_META: Record<Priority, { label: string; color: LabelColor }> = {
  low: { label: 'Baja', color: 'green' },
  medium: { label: 'Media', color: 'yellow' },
  high: { label: 'Alta', color: 'orange' },
};

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

/**
 * Formats a YYYY-MM-DD due date and reports whether it is overdue.
 * The date is parsed as local midnight: due dates are calendar days, not instants.
 */
export function describeDueDate(dueDate: string, today = new Date()) {
  const [y, m, d] = dueDate.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return { text: dateFormat.format(date), overdue: date < startOfToday };
}
