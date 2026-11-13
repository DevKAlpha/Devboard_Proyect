/**
 * Slack notices through an Incoming Webhook (one channel per board). Webhooks
 * need no sign-in and work from the browser: the message is sent as a "simple"
 * request (no-cors, text body), which Slack accepts and parses as JSON. The
 * reply cannot be read, so delivery is fire-and-forget.
 *
 * The webhook URL is a secret (anyone with it can post): it stays in this
 * browser's localStorage, never in the board, so it is neither synced to the
 * team nor exported. On team boards only the person who moves a card sends
 * the notice, so a channel never gets it twice.
 */

export interface SlackConfig {
  webhook: string;
  /** "all": every change of column. "done": only when a card reaches the last column. */
  notify: 'all' | 'done';
}

const key = (boardId: string) => `devbord:slack:${boardId}`;

export const isSlackWebhook = (url: string) =>
  /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_/-]+$/.test(url.trim());

export function readSlack(boardId: string): SlackConfig | null {
  try {
    const raw = localStorage.getItem(key(boardId));
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<SlackConfig>;
    if (typeof c.webhook !== 'string' || !isSlackWebhook(c.webhook)) return null;
    return { webhook: c.webhook, notify: c.notify === 'done' ? 'done' : 'all' };
  } catch {
    return null;
  }
}

/** Saves (or with null, removes) the board's Slack channel. */
export function saveSlack(boardId: string, config: SlackConfig | null) {
  try {
    if (config) localStorage.setItem(key(boardId), JSON.stringify(config));
    else localStorage.removeItem(key(boardId));
  } catch {
    // Storage blocked: notices just stay off.
  }
}

/** Slack mrkdwn needs &, < and > escaped; everything else is literal. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function postToSlack(webhook: string, text: string): Promise<void> {
  return fetch(webhook, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ text }) }).then(
    () => undefined,
  );
}

/** How many card titles one notice lists before "y N más". */
const LISTED = 5;

/** The notice for cards that changed column, e.g. "*Web* · #12 Login pasó a *Hecho*". */
export function moveMessage(input: {
  boardName: string;
  cards: { title: string; number: number | null }[];
  to: string;
  done: boolean;
}): string {
  const names = input.cards
    .slice(0, LISTED)
    .map((c) => `${c.number !== null ? `#${c.number} ` : ''}${esc(c.title)}`);
  const more = input.cards.length - LISTED;
  const list = names.join(', ') + (more > 0 ? ` y ${more} más` : '');
  const verb = input.cards.length === 1 ? 'pasó' : 'pasaron';
  return `${input.done ? ':white_check_mark: ' : ''}*${esc(input.boardName)}* · ${list} ${verb} a *${esc(input.to)}*`;
}
