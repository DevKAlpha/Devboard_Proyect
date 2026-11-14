import type { PullRequestRef } from '@devbord/shared';

/** Pull request state in words (Spanish UI). */
export const prLabel = (pr: PullRequestRef) =>
  pr.state === 'merged'
    ? 'fusionado'
    : pr.state === 'closed'
      ? 'cerrado'
      : pr.draft
        ? 'borrador'
        : 'abierto';
