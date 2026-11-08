/**
 * Column "kind": what a column means in the flow, guessed from its title
 * (English and Spanish), so ANY board gets the right status color and
 * decoration, including boards created before this existed.
 */
import type { LabelColor } from '@devbord/shared';

export type ColumnKind =
  'new' | 'icebox' | 'backlog' | 'sprint' | 'progress' | 'review' | 'done' | 'generic';

/** Order matters: the first match wins ("Sprint Backlog" is sprint, not backlog). */
const RULES: ReadonlyArray<[ColumnKind, RegExp]> = [
  ['icebox', /ice ?box|congelad|nevera|frozen|en pausa|algún día|someday/i],
  ['new', /new|nuev|ideas?$|entrada|inbox|triaje|triage/i],
  ['sprint', /sprint|to ?do|por hacer|pendiente/i],
  ['backlog', /backlog/i],
  ['progress', /progress|en curso|haciendo|doing|en marcha|estudiando|wip/i],
  ['review', /review|revisi|qa\b|verifica|repasar|test/i],
  ['done', /done|hecho|terminad|resuelto|aprobado|^listo$|complet|cerrad/i],
];

export function columnKind(title: string, isLastColumn = false): ColumnKind {
  for (const [kind, re] of RULES) if (re.test(title)) return kind;
  return isLastColumn ? 'done' : 'generic';
}

/** Status color per kind, following the GitHub Projects board palette. */
export const KIND_COLOR: Record<ColumnKind, LabelColor> = {
  new: 'green',
  icebox: 'blue',
  backlog: 'red',
  sprint: 'red',
  progress: 'yellow',
  review: 'purple',
  done: 'orange',
  generic: 'gray',
};
