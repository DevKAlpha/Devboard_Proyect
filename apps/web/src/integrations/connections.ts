/**
 * Connections to work suites (Google Workspace, Microsoft 365, Slack).
 *
 * Each connection describes what it can do as a list of tools shaped like
 * MCP tools (name, description, JSON Schema input, run). The board UI calls
 * them today; an AI agent or an MCP server in apps/api can list and call the
 * same tools later without new glue code.
 *
 * Future providers (GitHub, DevOps tools) plug in the same way. Note for
 * GitHub: its OAuth App flow needs a client secret, so the token exchange must
 * go through apps/api.
 */
import type { GithubOp, StoryPoints } from '@devbord/shared';
import { ACCOUNTS, createCalendarEvent, type AccountId } from './accounts';
import { postToSlack, readSlack } from './slack';
import { githubApi } from './github/client';

export type ConnectionId = AccountId | 'slack' | 'github';

/** One action a connection offers (MCP "tool"). */
export interface ConnectionTool {
  name: string;
  description: string;
  /** JSON Schema of the input, as MCP declares it. */
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: 'string'; description: string; format?: string }>;
    required: string[];
  };
  /** Runs the tool; resolves with a short result (a link or a status). */
  run: (input: Record<string, unknown>) => Promise<string>;
}

export interface Connection {
  id: ConnectionId;
  name: string;
  /** What connecting adds, in the user's words. */
  description: string;
  tools: ConnectionTool[];
}

/** Reads a required string input, the only validation the tools need. */
const str = (input: Record<string, unknown>, key: string) => {
  const v = input[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Falta "${key}".`);
  return v;
};

/** A GitHub tool: every input is a string, plus the Project it acts on. */
function githubTool(
  name: string,
  description: string,
  fields: Record<string, string>,
  toOp: (input: Record<string, string | undefined>) => GithubOp,
): ConnectionTool {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project de GitHub' },
        ...Object.fromEntries(
          Object.entries(fields).map(([k, d]) => [k, { type: 'string', description: d }]),
        ),
      },
      required: ['projectId', ...Object.keys(fields)],
    },
    run: async (input) => {
      const values: Record<string, string> = {};
      for (const key of ['projectId', ...Object.keys(fields)]) values[key] = str(input, key);
      await githubApi.op(values.projectId!, toOp(values));
      return 'Hecho';
    },
  };
}

const calendarTool = (id: AccountId, calendar: string): ConnectionTool => ({
  name: 'create_calendar_event',
  description: `Crea un evento de día completo en ${calendar} (por ejemplo, la fecha límite de una tarjeta).`,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título del evento' },
      date: { type: 'string', format: 'date', description: 'Día (AAAA-MM-DD)' },
      details: { type: 'string', description: 'Descripción' },
    },
    required: ['title', 'date'],
  },
  run: (input) =>
    createCalendarEvent(id, {
      title: str(input, 'title'),
      date: str(input, 'date'),
      details: typeof input.details === 'string' ? input.details : '',
    }),
});

export const CONNECTIONS: readonly Connection[] = [
  {
    id: 'github',
    name: 'GitHub',
    description:
      'El tablero refleja un Project de GitHub: lo que cambies aquí se ve allí y al revés (issues, Status, estimaciones, sprints, epics y PRs).',
    tools: [
      githubTool(
        'create_issue',
        'Crea un issue en el repo del Project y lo pone en una columna.',
        {
          columnId: 'Columna (opción de Status)',
          title: 'Título',
        },
        (i) => ({ type: 'createCard', columnId: i.columnId!, title: i.title! }),
      ),
      githubTool(
        'move_card',
        'Mueve una tarjeta a otra columna (cambia su Status).',
        {
          cardId: 'Tarjeta (item del Project)',
          columnId: 'Columna de destino',
        },
        (i) => ({ type: 'moveCard', cardId: i.cardId!, columnId: i.columnId!, afterCardId: null }),
      ),
      githubTool(
        'set_estimate',
        'Pone los story points (campo Estimate).',
        {
          cardId: 'Tarjeta',
          points: 'Puntos: 1, 2, 3, 5, 8 o 13',
        },
        (i) => ({
          type: 'updateCard',
          cardId: i.cardId!,
          patch: { storyPoints: Number(i.points) as StoryPoints },
        }),
      ),
      githubTool(
        'set_sprint',
        'Pone la tarjeta en un sprint (campo Iteration).',
        {
          cardId: 'Tarjeta',
          sprint: 'Nombre de la iteración',
        },
        (i) => ({ type: 'updateCard', cardId: i.cardId!, patch: { sprint: i.sprint! } }),
      ),
      githubTool(
        'link_epic',
        'Mete una tarjeta en una epic (sub-issue).',
        {
          cardId: 'Tarjeta',
          epicCardId: 'Tarjeta de la epic',
        },
        (i) => ({ type: 'setParent', cardId: i.cardId!, parentCardId: i.epicCardId! }),
      ),
      {
        name: 'list_pull_requests',
        description: 'Lista los PRs enlazados a las tarjetas del Project.',
        inputSchema: {
          type: 'object',
          properties: { projectId: { type: 'string', description: 'Project de GitHub' } },
          required: ['projectId'],
        },
        run: async (input) => {
          const board = await githubApi.board(str(input, 'projectId'));
          const prs = board.columns.flatMap((c) =>
            c.cards.flatMap((card) =>
              (card.github?.pullRequests ?? []).map((pr) => ({ card: card.title, ...pr })),
            ),
          );
          return JSON.stringify(prs);
        },
      },
    ],
  },
  {
    id: 'google',
    name: ACCOUNTS.google.name,
    description: 'Crea las fechas de tus tarjetas directamente en Google Calendar.',
    tools: [calendarTool('google', 'Google Calendar')],
  },
  {
    id: 'microsoft',
    name: ACCOUNTS.microsoft.name,
    description: 'Crea las fechas de tus tarjetas directamente en tu calendario de Outlook.',
    tools: [calendarTool('microsoft', 'Outlook')],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Avisa en un canal cuando las tarjetas de este tablero cambian de columna.',
    tools: [
      {
        name: 'post_message',
        description: 'Publica un mensaje en el canal de Slack del tablero.',
        inputSchema: {
          type: 'object',
          properties: {
            boardId: { type: 'string', description: 'Tablero cuyo canal se usa' },
            text: { type: 'string', description: 'Mensaje (formato mrkdwn de Slack)' },
          },
          required: ['boardId', 'text'],
        },
        run: async (input) => {
          const config = readSlack(str(input, 'boardId'));
          if (!config) throw new Error('Este tablero no tiene canal de Slack.');
          await postToSlack(config.webhook, str(input, 'text'));
          return 'Enviado';
        },
      },
    ],
  },
];

/** Calls a connection's tool by name, the way an agent would. */
export function runTool(id: ConnectionId, name: string, input: Record<string, unknown>) {
  const tool = CONNECTIONS.find((c) => c.id === id)?.tools.find((t) => t.name === name);
  if (!tool) return Promise.reject(new Error(`No existe la herramienta ${name}.`));
  return tool.run(input);
}
