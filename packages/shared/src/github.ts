/**
 * GitHub Projects (v2) link of a board, Zenhub-style: the board mirrors a
 * Project and GitHub is the source of truth. Ids are reused on purpose so no
 * mapping tables are needed:
 *  - Column.id = id of the Project's Status option ("none" for items without one)
 *  - Card.id   = id of the Project item
 *  - Label.id  = id of the repository label
 *
 * This file only depends on zod, so schemas.ts can import it without cycles.
 */
import { z } from 'zod';

/** Column that holds the Project items with no Status yet (Zenhub's "New Issues"). */
export const NO_STATUS_COLUMN = 'none';

export const GithubIterationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** YYYY-MM-DD. */
  startDate: z.iso.date(),
  /** Days. */
  duration: z.number().int().positive(),
});
export type GithubIteration = z.infer<typeof GithubIterationSchema>;

export const GithubUserSchema = z.object({
  login: z.string().min(1),
  avatarUrl: z.httpUrl(),
});
export type GithubUser = z.infer<typeof GithubUserSchema>;

/**
 * Optional Project fields Devbord found and maps (by name, see the API
 * mapper). A missing field turns its feature off in the UI.
 */
export const GithubFieldsSchema = z.object({
  estimate: z.boolean().default(false),
  iteration: z.boolean().default(false),
  dueDate: z.boolean().default(false),
  priority: z.boolean().default(false),
});

export const GithubLinkSchema = z.object({
  projectId: z.string().min(1),
  /** Project number, as in github.com/orgs/<owner>/projects/<number>. */
  number: z.number().int().positive(),
  owner: z.string().min(1),
  url: z.httpUrl(),
  /** "owner/name" where new cards become issues. Null: the Project has no linked repo. */
  defaultRepo: z.string().nullable().default(null),
  iterations: z.array(GithubIterationSchema).default([]),
  /** People who can be assigned in the default repo. */
  assignable: z.array(GithubUserSchema).default([]),
  fields: GithubFieldsSchema.default({
    estimate: false,
    iteration: false,
    dueDate: false,
    priority: false,
  }),
});
export type GithubLink = z.infer<typeof GithubLinkSchema>;

export const PullRequestRefSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  url: z.httpUrl(),
  state: z.enum(['open', 'closed', 'merged']),
  draft: z.boolean().default(false),
});
export type PullRequestRef = z.infer<typeof PullRequestRefSchema>;

export const IssueRefSchema = z.object({
  issueId: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string(),
  url: z.httpUrl(),
});
export type IssueRef = z.infer<typeof IssueRefSchema>;

/** The issue behind a card. Draft items of the Project have none. */
export const CardGithubSchema = z.object({
  issueId: z.string().min(1),
  /** "owner/name". */
  repo: z.string().min(1),
  number: z.number().int().positive(),
  url: z.httpUrl(),
  state: z.enum(['open', 'closed']),
  assignees: z.array(GithubUserSchema).default([]),
  /** Epic: the parent issue (GitHub sub-issues). */
  parent: IssueRefSchema.nullable().default(null),
  /** Set when the issue is an epic (has sub-issues). */
  subIssues: z
    .object({ total: z.number().int().min(0), completed: z.number().int().min(0) })
    .nullable()
    .default(null),
  pullRequests: z.array(PullRequestRefSchema).default([]),
});
export type CardGithub = z.infer<typeof CardGithubSchema>;
