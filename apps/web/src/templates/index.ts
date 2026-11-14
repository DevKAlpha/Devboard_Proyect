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
 * Network change request (RFC), the usual form of network change management:
 * what changes and where, its impact, the step-by-step plan (MOP), how to
 * undo it and how to prove it worked.
 */
export const NETWORK_CHANGE_TEMPLATE = `**Tipo de cambio:** Estándar / Normal / Emergencia
**Equipos afectados:** [hostname, IP, sitio]
**Impacto:** [servicios, usuarios, VLANs o enlaces afectados]

### Plan de implementación (MOP)
1. Respaldar la configuración actual
2. [paso o comando]

### Plan de rollback
1. [cómo volver al estado anterior]

### Verificación
- [ ] ping / traceroute a [destino]
- [ ] show ip route / show interfaces [interfaz]
- [ ] Monitoreo sin alarmas durante 30 min

### Ventana de mantenimiento
[fecha, hora y duración]`;

/** Builds a filled-in network change in the same format as the template. */
const networkChange = (c: {
  kind: string;
  devices: string;
  impact: string;
  steps: string[];
  rollback: string[];
  checks: string[];
}) => `**Tipo de cambio:** ${c.kind}
**Equipos afectados:** ${c.devices}
**Impacto:** ${c.impact}

### Plan de implementación (MOP)
1. Respaldar la configuración actual
${c.steps.map((s, i) => `${i + 2}. ${s}`).join('\n')}

### Plan de rollback
${c.rollback.map((s, i) => `${i + 1}. ${s}`).join('\n')}

### Verificación
${c.checks.map((s) => `- [ ] ${s}`).join('\n')}

### Ventana de mantenimiento
Por definir`;

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
    // Network engineering: change management (RFC → CAB → maintenance window →
    // implementation → verification), plus incidents, as NOC/NetOps teams work.
    id: 'network',
    profile: 'technical',
    name: 'Redes',
    description:
      'Cambios de red con plan de rollback, aprobación y ventana de mantenimiento. Routing, VLANs, firewall, VPN y Wi-Fi.',
    columns: [
      'Solicitudes',
      'Diseño',
      'Aprobación (CAB)',
      'Ventana programada',
      'Implementación',
      'Verificación',
      'Cerrado',
    ],
    columnDescriptions: [
      'Cambios e incidencias recién llegados',
      'Topología, direccionamiento y plan (MOP)',
      'Esperando el visto bueno del comité de cambios',
      'Aprobado, con fecha y hora de mantenimiento',
      'Aplicándose en los equipos ahora',
      'Pruebas y monitoreo después del cambio',
      'Verificado y documentado',
    ],
    // Few changes in the network at once: every one is a risk of outage.
    wipLimits: [null, 4, null, null, 2, 3, null],
    labels: [
      { name: 'Routing', color: 'blue' },
      { name: 'Switching/VLAN', color: 'green' },
      { name: 'Firewall', color: 'red' },
      { name: 'VPN', color: 'purple' },
      { name: 'Wi-Fi', color: 'yellow' },
      { name: 'Monitoreo', color: 'orange' },
    ],
    cardTemplate: NETWORK_CHANGE_TEMPLATE,
    cards: [
      {
        column: 0,
        title: 'Cómo usar este tablero',
        patch: {
          description: `Flujo de gestión de cambios de red:
* **Solicitudes**: cada cambio o incidencia entra como tarjeta. Las incidencias son tipo *bug*.
* **Diseño**: completa la plantilla (equipos, impacto, MOP, rollback y pruebas).
* **Aprobación (CAB)**: sin plan de rollback no se aprueba.
* **Ventana programada**: pon la fecha de la ventana en la tarjeta.
* **Implementación**: límite WIP 2. Pocos cambios a la vez = menos riesgo de caída.
* **Verificación**: ejecuta las pruebas y deja el monitoreo mirando antes de cerrar.

Consejos:
* Respalda la configuración (running-config) antes de tocar un equipo.
* Usa las etiquetas para saber qué capa afecta cada cambio.
* Story points = riesgo y esfuerzo del cambio.`,
        },
      },
      {
        column: 0,
        title: 'Pérdida de paquetes en el enlace WAN de la sede Norte',
        labels: ['Monitoreo', 'Routing'],
        patch: { type: 'bug', priority: 'high' },
      },
      {
        column: 1,
        title: 'Nueva VLAN 30 para la red de invitados',
        labels: ['Switching/VLAN', 'Wi-Fi'],
        patch: {
          type: 'feature',
          priority: 'medium',
          storyPoints: 3,
          description: networkChange({
            kind: 'Normal',
            devices: 'SW-CORE-01, SW-ACC-03/04, WLC-01',
            impact: 'Ninguno para usuarios actuales; nueva red aislada para invitados',
            steps: [
              'Crear VLAN 30 (INVITADOS) en el core y en los switches de acceso',
              'Configurar la SVI 10.30.0.1/24 con DHCP relay',
              'Añadir la VLAN a los troncales hacia los AP',
              'Crear el SSID "Invitados" mapeado a la VLAN 30 en la controladora',
              'ACL: la VLAN 30 solo sale a Internet, sin acceso a redes internas',
            ],
            rollback: ['Borrar el SSID y la VLAN 30', 'Restaurar running-config del respaldo'],
            checks: [
              'Un cliente en "Invitados" recibe IP 10.30.0.x',
              'ping 8.8.8.8 desde la VLAN 30: OK',
              'ping a 10.10.0.0/16 desde la VLAN 30: bloqueado',
            ],
          }),
        },
      },
      {
        column: 2,
        title: 'Abrir 443/TCP hacia el nuevo servidor web en la DMZ',
        labels: ['Firewall'],
        patch: { type: 'task', priority: 'medium', storyPoints: 2 },
      },
      {
        column: 3,
        title: 'Actualizar el sistema operativo del router de borde',
        labels: ['Routing'],
        patch: { type: 'task', priority: 'high', storyPoints: 5, sprint: 'Ventana sábado' },
      },
      {
        column: 4,
        title: 'Túnel IPsec con la sucursal Sur',
        labels: ['VPN'],
        patch: { type: 'feature', priority: 'medium', storyPoints: 5 },
      },
      {
        column: 5,
        title: 'Cobertura Wi-Fi en la planta 2',
        labels: ['Wi-Fi', 'Monitoreo'],
        patch: { type: 'task', priority: 'low', storyPoints: 2 },
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

/**
 * Templates for a profile; the blank one suits everybody. Seasonal looks are
 * not templates: they are the "Tema" picked below the templates.
 */
export const templatesFor = (profile: Profile) =>
  TEMPLATES.filter((t) => t.profile === profile || t.id === 'blank');

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
    skin: options.skin,
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
