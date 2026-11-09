/**
 * Board templates — the "easy door" into Devbord.
 *
 * A template is plain data (columns, labels, a few example cards), so adding
 * one is a data change only. Example cards teach the tool by example
 * ("drag me", "open me") instead of a tutorial.
 */
import {
  addNewCard,
  createBoard,
  createCard,
  type Board,
  type BoardMode,
  type BoardSkin,
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
  /** WIP limit per column, aligned with `columns` (null = unlimited). */
  wipLimits?: (number | null)[];
  /** One-line description per column, aligned with `columns`. */
  columnDescriptions?: string[];
  labels: { name: string; color: LabelColor }[];
  /** Description pre-filled in every new card of the board. */
  cardTemplate?: string;
  /** Seasonal look the board starts with (design/skins.css). Offered to every profile. */
  skin?: BoardSkin;
  /** `column` is an index into `columns`; `labels` are label names. */
  cards: { column: number; title: string; labels?: string[]; patch?: CardPatch }[];
}

/**
 * User story template, same structure as the GitHub issue template used in
 * DevKAlpha/agile-final-project (.github/ISSUE_TEMPLATE/user-story.md):
 * role, need, benefit, then details and Gherkin acceptance criteria.
 */
export const USER_STORY_TEMPLATE = `**Como** [rol]
**Necesito** [función]
**Para que** [beneficio]

### Detalles y Suposiciones
* [documenta lo que sabes]

### Criterios de Aceptación
\`\`\`gherkin
Dado [algún contexto]
Cuando [se realiza cierta acción]
Entonces [se observa el resultado de la acción]
\`\`\``;

/** Builds a filled-in user story in the same format as the template. */
const story = (s: {
  role: string;
  need: string;
  benefit: string;
  details: string[];
  gherkin: string[];
}) => `**Como** ${s.role}
**Necesito** ${s.need}
**Para que** ${s.benefit}

### Detalles y Suposiciones
${s.details.map((d) => `* ${d}`).join('\n')}

### Criterios de Aceptación
\`\`\`gherkin
${s.gherkin.join('\n')}
\`\`\``;

/**
 * Column structure of a GitHub Projects board (agile-planning reference repos):
 * names, WIP limits ("2/5") and the one-line descriptions under each title.
 */
const GITHUB_BOARD = {
  columns: [
    'New issues',
    'Icebox',
    'Product Backlog',
    'Sprint Backlog',
    'In progress',
    'In review',
    'Done',
  ],
  columnDescriptions: [
    'Recién llegado, aún sin refinar',
    'Listo para que alguien lo tome',
    'Aún no se ha empezado',
    'Comprometido para este sprint',
    'Se está trabajando activamente',
    'Esperando revisión',
    'Completado',
  ],
  // Lean: limit work in progress where work actually happens.
  wipLimits: [null, null, 5, null, 3, 5, null],
};

export const TEMPLATES: readonly BoardTemplate[] = [
  {
    // Scrum board as used in the agile-planning reference repos (GitHub Projects):
    // New issues → Icebox → Product Backlog → Sprint Backlog → In progress → In review → Done.
    id: 'scrum',
    profile: 'technical',
    name: 'Scrum',
    description:
      'Historias de usuario con criterios Gherkin, story points y límites WIP. Flujo Lean: termina antes de empezar.',
    ...GITHUB_BOARD,
    // Same labels as the reference repositories.
    labels: [
      { name: 'enhancement', color: 'blue' },
      { name: 'bug', color: 'red' },
      { name: 'technical debt', color: 'orange' },
    ],
    cardTemplate: USER_STORY_TEMPLATE,
    cards: [
      {
        column: 0,
        title: 'Cómo usar este tablero',
        patch: {
          description: `Flujo: una idea entra en **New Issues**. Se refina (historia + criterios + story points) y pasa a **Product Backlog**, ordenado por valor. Lo que no es prioritario espera en **Icebox**.

En la planificación, el equipo trae al **Sprint Backlog** lo que cabe en el sprint.

Principios ágiles y Lean aplicados:
* Entrega valor pronto y a menudo: historias pequeñas (≤ 8 puntos; 13 = divídela).
* Limita el trabajo en curso (WIP): Product Backlog 5, In progress 3, In review 5. Si la columna se pone roja, termina antes de empezar algo nuevo.
* Tira del trabajo (pull), no lo empujes.
* Elimina desperdicio: sin criterios de aceptación, no entra al sprint.
* Mejora continua: revisa el flujo en cada retrospectiva.`,
        },
      },
      {
        column: 1,
        title: 'Valorar productos con "me gusta"',
        labels: ['enhancement'],
        patch: {
          description: story({
            role: 'usuario del sistema',
            need: 'marcar un producto con "me gusta"',
            benefit: 'pueda expresar mi preferencia',
            details: ['El usuario debe estar autenticado', 'Solo un "me gusta" por producto'],
            gherkin: [
              'Dado que soy un usuario autenticado',
              'Y existe un producto en el catálogo',
              'Cuando marco el producto con "me gusta"',
              'Entonces el sistema registra mi preferencia',
            ],
          }),
        },
      },
      {
        column: 2,
        title: 'Filtrar productos',
        labels: ['enhancement'],
        patch: {
          type: 'feature',
          priority: 'medium',
          storyPoints: 5,
          description: story({
            role: 'usuario del sistema',
            need: 'consultar un subconjunto de productos',
            benefit: 'encuentre productos según criterios concretos',
            details: ['Filtros por categoría, precio o popularidad', 'Resultados paginados'],
            gherkin: [
              'Dado que existen productos en el catálogo',
              'Cuando aplico filtros de búsqueda',
              'Entonces el sistema devuelve solo los productos que cumplen los criterios',
            ],
          }),
        },
      },
      {
        column: 3,
        title: 'Listar productos',
        labels: ['enhancement'],
        patch: {
          type: 'feature',
          priority: 'high',
          storyPoints: 3,
          sprint: 'Sprint 1',
          description: story({
            role: 'usuario del sistema',
            need: 'listar todos los productos del catálogo',
            benefit: 'pueda explorar las opciones disponibles',
            details: ['La lista puede ir paginada'],
            gherkin: [
              'Dado que existen productos en el catálogo',
              'Cuando solicito la lista de productos',
              'Entonces el sistema muestra todos los productos disponibles',
            ],
          }),
        },
      },
      {
        column: 4,
        title: 'Automatizar el despliegue',
        labels: ['technical debt'],
        patch: {
          type: 'task',
          priority: 'medium',
          storyPoints: 8,
          sprint: 'Sprint 1',
          description: story({
            role: 'equipo de desarrollo',
            need: 'desplegar automáticamente en la nube',
            benefit: 'entreguemos cambios de forma rápida y fiable',
            details: [
              'Se usará un pipeline CI/CD',
              'El despliegue ocurre tras aprobar los cambios',
            ],
            gherkin: [
              'Dado que se hace un cambio en el código',
              'Cuando el cambio se aprueba y se fusiona',
              'Entonces el sistema se despliega automáticamente',
            ],
          }),
        },
      },
      {
        column: 6,
        title: 'Definición de Hecho (DoD)',
        patch: {
          description: `Una historia está **Hecha** cuando:
* Cumple todos sus criterios de aceptación.
* El código está revisado (pull request aprobada).
* Tiene pruebas automatizadas y pasan en CI.
* Está desplegada y el Product Owner la aceptó.`,
        },
      },
    ],
  },
  {
    id: 'dev-sprint',
    profile: 'technical',
    name: 'Sprint de desarrollo',
    description: 'Tablero estilo GitHub Projects: del issue nuevo a Done, con bugs y features.',
    ...GITHUB_BOARD,
    labels: [
      { name: 'frontend', color: 'blue' },
      { name: 'backend', color: 'purple' },
      { name: 'infra', color: 'orange' },
    ],
    cards: [
      {
        column: 2,
        title: 'Conectar repositorio de GitHub',
        labels: ['infra'],
        patch: { type: 'feature', priority: 'medium' },
      },
      {
        column: 3,
        title: 'Arrastra esta tarjeta a "In progress"',
        labels: ['frontend'],
        patch: { type: 'task', priority: 'low', sprint: 'Sprint 1' },
      },
      {
        column: 4,
        title: 'Corregir login en Safari',
        labels: ['frontend'],
        patch: { type: 'bug', priority: 'high', sprint: 'Sprint 1' },
      },
      {
        column: 5,
        title: 'Abre esta tarjeta para ver sus detalles',
        labels: ['backend'],
        patch: {
          sprint: 'Sprint 1',
          description: 'Aquí puedes escribir criterios de aceptación, notas o enlaces.',
        },
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
    id: 'halloween',
    profile: 'simple',
    skin: 'halloween',
    name: 'Noche de Halloween',
    description: 'Calabazas, murciélagos y telarañas. Con su propio aspecto.',
    columns: ['Pendientes', 'En el caldero', 'Hechizo en revisión', 'Hecho'],
    labels: [
      { name: 'Disfraces', color: 'purple' },
      { name: 'Dulces', color: 'orange' },
      { name: 'Decoración', color: 'green' },
    ],
    cards: [
      { column: 0, title: 'Tallar las calabazas', labels: ['Decoración'] },
      { column: 0, title: 'Comprar dulces para la puerta', labels: ['Dulces'] },
      { column: 1, title: 'Coser el disfraz de bruja', labels: ['Disfraces'] },
      { column: 3, title: 'Colgar las telarañas', labels: ['Decoración'] },
    ],
  },
  {
    id: 'christmas',
    profile: 'simple',
    skin: 'christmas',
    name: 'Taller de Navidad',
    description: 'Regalos, decoración y cena bajo la nieve. Con su propio aspecto.',
    columns: ['Lista de deseos', 'Por hacer', 'En el taller', 'Envuelto'],
    labels: [
      { name: 'Regalos', color: 'red' },
      { name: 'Casa', color: 'green' },
      { name: 'Cena', color: 'yellow' },
    ],
    cards: [
      { column: 0, title: 'Ideas de regalo para la familia', labels: ['Regalos'] },
      { column: 1, title: 'Decorar el árbol', labels: ['Casa'] },
      { column: 1, title: 'Escribir las tarjetas', labels: ['Regalos'] },
      { column: 2, title: 'Preparar el menú de Nochebuena', labels: ['Cena'] },
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

/** Templates for a profile; the blank and the seasonal ones suit everybody. */
export const templatesFor = (profile: Profile) =>
  TEMPLATES.filter((t) => t.profile === profile || t.id === 'blank' || t.skin);

export const getTemplate = (id: string) => TEMPLATES.find((t) => t.id === id);

/**
 * Builds a ready-to-use board from a template.
 * The board's profile comes from the user's choice, so "En blanco" works for both.
 */
export function buildBoardFromTemplate(
  template: BoardTemplate,
  options: { name?: string; profile?: Profile; mode?: BoardMode; skin?: BoardSkin } = {},
): Board {
  let board = createBoard({
    name: options.name?.trim() || template.name,
    profile: options.profile ?? template.profile,
    mode: options.mode,
    skin: options.skin ?? template.skin,
    templateId: template.id,
    columnTitles: template.columns,
    wipLimits: template.wipLimits,
    columnDescriptions: template.columnDescriptions,
    labels: template.labels,
    cardTemplate: template.cardTemplate ?? null,
  });

  const labelId = new Map(board.labels.map((l) => [l.name, l.id]));
  for (const seed of template.cards) {
    const column = board.columns[seed.column];
    if (!column) continue;
    const labelIds = (seed.labels ?? []).flatMap((name) => labelId.get(name) ?? []);
    board = addNewCard(board, column.id, createCard(seed.title, { ...seed.patch, labelIds }));
  }
  return board;
}
