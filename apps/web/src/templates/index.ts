/**
 * Board templates — the "easy door" into Devbord.
 *
 * A template is plain data (columns, labels, a few example cards), so adding
 * one is a data change only. Example cards teach the tool by example
 * ("drag me", "open me") instead of a tutorial.
 */
import {
  addCard,
  createBoard,
  createCard,
  type Board,
  type CardPatch,
  type LabelColor,
  type Profile,
} from '@devbord/shared';

export interface BoardTemplate {
  id: string;
  profile: Profile;
  name: string;
  description: string;
  columns: string[];
  labels: { name: string; color: LabelColor }[];
  /** `column` is an index into `columns`; `labels` are label names. */
  cards: { column: number; title: string; labels?: string[]; patch?: CardPatch }[];
}

export const TEMPLATES: readonly BoardTemplate[] = [
  {
    id: 'dev-sprint',
    profile: 'technical',
    name: 'Sprint de desarrollo',
    description: 'Backlog, revisión y despliegue. Bugs y features con prioridad.',
    columns: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'],
    labels: [
      { name: 'frontend', color: 'blue' },
      { name: 'backend', color: 'purple' },
      { name: 'infra', color: 'orange' },
    ],
    cards: [
      {
        column: 0,
        title: 'Conectar repositorio de GitHub',
        labels: ['infra'],
        patch: { type: 'feature', priority: 'medium' },
      },
      {
        column: 1,
        title: 'Arrastra esta tarjeta a "In Progress"',
        labels: ['frontend'],
        patch: { type: 'task', priority: 'low' },
      },
      {
        column: 2,
        title: 'Corregir login en Safari',
        labels: ['frontend'],
        patch: { type: 'bug', priority: 'high' },
      },
      {
        column: 3,
        title: 'Abre esta tarjeta para ver sus detalles',
        labels: ['backend'],
        patch: { description: 'Aquí puedes escribir criterios de aceptación, notas o enlaces.' },
      },
    ],
  },
  {
    id: 'bug-tracker',
    profile: 'technical',
    name: 'Incidencias y DevOps',
    description: 'Triaje de bugs e incidencias, de "Nuevo" a "Resuelto".',
    columns: ['Nuevo', 'Triaje', 'En curso', 'Verificación', 'Resuelto'],
    labels: [
      { name: 'producción', color: 'red' },
      { name: 'staging', color: 'yellow' },
      { name: 'CI/CD', color: 'orange' },
    ],
    cards: [
      {
        column: 0,
        title: 'Error 500 al exportar CSV',
        labels: ['producción'],
        patch: { type: 'bug', priority: 'high' },
      },
      {
        column: 1,
        title: 'Pipeline lento en tests e2e',
        labels: ['CI/CD'],
        patch: { type: 'task', priority: 'medium' },
      },
    ],
  },
  {
    id: 'personal',
    profile: 'simple',
    name: 'Mis tareas',
    description: 'Lo esencial para organizar tu día a día.',
    columns: ['Por hacer', 'Haciendo', 'Hecho'],
    labels: [
      { name: 'Casa', color: 'green' },
      { name: 'Trabajo', color: 'blue' },
      { name: 'Urgente', color: 'red' },
    ],
    cards: [
      { column: 0, title: 'Arrastra esta tarjeta a "Haciendo"', labels: ['Casa'] },
      { column: 0, title: 'Pulsa una tarjeta para añadir notas o una fecha', labels: ['Trabajo'] },
      { column: 2, title: 'Crear mi primer tablero', labels: [] },
    ],
  },
  {
    id: 'team-project',
    profile: 'simple',
    name: 'Proyecto de equipo',
    description: 'Ideas, tareas y entregas para marketing, ventas o eventos.',
    columns: ['Ideas', 'Por hacer', 'En marcha', 'En revisión', 'Listo'],
    labels: [
      { name: 'Marketing', color: 'purple' },
      { name: 'Ventas', color: 'green' },
      { name: 'Diseño', color: 'yellow' },
    ],
    cards: [
      { column: 0, title: 'Campaña de lanzamiento', labels: ['Marketing'] },
      { column: 1, title: 'Preparar presentación para clientes', labels: ['Ventas'] },
      { column: 2, title: 'Nuevo logo', labels: ['Diseño'] },
    ],
  },
  {
    id: 'study',
    profile: 'simple',
    name: 'Estudios',
    description: 'Asignaturas, entregas y exámenes bajo control.',
    columns: ['Pendiente', 'Estudiando', 'Repasar', 'Aprobado'],
    labels: [
      { name: 'Examen', color: 'red' },
      { name: 'Entrega', color: 'blue' },
    ],
    cards: [
      { column: 0, title: 'Trabajo final de Historia', labels: ['Entrega'] },
      { column: 1, title: 'Tema 3 de Matemáticas', labels: ['Examen'] },
    ],
  },
  {
    id: 'blank',
    profile: 'simple',
    name: 'En blanco',
    description: 'Tres columnas vacías. Tú decides el resto.',
    columns: ['Por hacer', 'Haciendo', 'Hecho'],
    labels: [],
    cards: [],
  },
];

export const templatesFor = (profile: Profile) =>
  TEMPLATES.filter((t) => t.profile === profile || t.id === 'blank');

export const getTemplate = (id: string) => TEMPLATES.find((t) => t.id === id);

/**
 * Builds a ready-to-use board from a template.
 * The board's profile comes from the user's choice, so "En blanco" works for both.
 */
export function buildBoardFromTemplate(
  template: BoardTemplate,
  options: { name?: string; profile?: Profile } = {},
): Board {
  let board = createBoard({
    name: options.name?.trim() || template.name,
    profile: options.profile ?? template.profile,
    templateId: template.id,
    columnTitles: template.columns,
    labels: template.labels,
  });

  const labelId = new Map(board.labels.map((l) => [l.name, l.id]));
  for (const seed of template.cards) {
    const column = board.columns[seed.column];
    if (!column) continue;
    const labelIds = (seed.labels ?? []).flatMap((name) => labelId.get(name) ?? []);
    board = addCard(board, column.id, createCard(seed.title, { ...seed.patch, labelIds }));
  }
  return board;
}
