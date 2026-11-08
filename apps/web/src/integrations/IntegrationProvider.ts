/**
 * Integration contract for external services (GitHub, Google Workspace,
 * Microsoft 365, AI agents, DevOps tools).
 *
 * Nothing implements this yet. It fixes the shape early, so each provider
 * plugs in the same way and the board UI can list, connect and use them
 * generically.
 *
 * Auth notes for implementers:
 *  - Google and Microsoft (Entra ID) support OAuth 2.0 Authorization Code +
 *    PKCE for SPAs, so they can run from GitHub Pages without a secret.
 *  - The GitHub OAuth App flow needs a client secret, so the token exchange
 *    must go through apps/api. A GitHub App with a backend is preferred for
 *    repo webhooks.
 *  - Never store tokens in board data. Keep them in a dedicated store
 *    (memory / sessionStorage now, server-side later).
 */
import type { Board, Card } from '@devbord/shared';

export type IntegrationId = 'github' | 'google' | 'microsoft' | 'ai-agent';

export type IntegrationCapability =
  /** Link a card to an external item (issue, PR, doc, email, event). */
  | 'link'
  /** Create cards from external items (e.g. import GitHub issues). */
  | 'import'
  /** Push card changes outward (e.g. close the issue when the card is Done). */
  | 'sync'
  /** Due dates to Google Calendar or Outlook. */
  | 'calendar'
  /** Act on a board on the user's behalf (AI agents). */
  | 'automate';

/** Reference stored on a card that points to an external resource. */
export interface ExternalRef {
  provider: IntegrationId;
  /** Provider-specific stable id, e.g. "owner/repo#42". */
  externalId: string;
  url: string;
  title?: string;
}

export interface IntegrationProvider {
  readonly id: IntegrationId;
  readonly name: string;
  readonly capabilities: readonly IntegrationCapability[];

  isConnected(): Promise<boolean>;
  /** Starts the auth flow (usually a redirect or popup). */
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  /** Optional hooks: implement only what `capabilities` declares. */
  importCards?(board: Board, query: string): Promise<Card[]>;
  resolveRef?(url: string): Promise<ExternalRef | null>;
  onCardMoved?(board: Board, card: Card, toColumnTitle: string): Promise<void>;
}
