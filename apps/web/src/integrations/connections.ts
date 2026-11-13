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
import { ACCOUNTS, createCalendarEvent, type AccountId } from './accounts';
import { postToSlack, readSlack } from './slack';

export type ConnectionId = AccountId | 'slack';

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
