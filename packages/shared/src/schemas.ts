/**
 * Domain schemas — the single source of truth for Devbord's data model.
 *
 * Both the web app (IndexedDB persistence) and the API (request validation)
 * validate against these, so a board created offline can later be synced to
 * the server without any mapping layer.
 */
import { z } from 'zod';

/** Who the workspace is tuned for. Drives which card fields and wording the UI shows. */
export const ProfileSchema = z.enum(['technical', 'simple']);
export type Profile = z.infer<typeof ProfileSchema>;

/**
 * Who works on the board, chosen once at creation and never changed:
 * personal boards stay private to this browser, team boards sync in real time.
 * Keeping them apart avoids mixing someone's own work with shared work.
 */
export const BoardModeSchema = z.enum(['personal', 'team']);
export type BoardMode = z.infer<typeof BoardModeSchema>;

/** Card categories used by technical boards (hidden for the "simple" profile). */
export const CardTypeSchema = z.enum(['task', 'feature', 'bug']);
export type CardType = z.infer<typeof CardTypeSchema>;

export const PrioritySchema = z.enum(['low', 'medium', 'high']);
export type Priority = z.infer<typeof PrioritySchema>;

/** Soft palette keys; actual colors live in the web design tokens. */
export const LabelColorSchema = z.enum([
  'blue',
  'green',
  'yellow',
  'orange',
  'red',
  'purple',
  'gray',
]);
export type LabelColor = z.infer<typeof LabelColorSchema>;

/**
 * Story points use the modified Fibonacci scale common in Scrum: the gaps grow
 * with size, which reflects how uncertainty grows. 13 is the ceiling: anything
 * bigger is an epic and should be split (small batches, a Lean principle).
 */
/** How many recent column changes a card remembers. */
export const MOVE_LOG_SIZE = 5;

export const STORY_POINTS = [1, 2, 3, 5, 8, 13] as const;
export const StoryPointsSchema = z.literal(STORY_POINTS);
export type StoryPoints = z.infer<typeof StoryPointsSchema>;

export const LabelSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(30),
  color: LabelColorSchema,
});
export type Label = z.infer<typeof LabelSchema>;

export const CardSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).default(''),
  /** References Label.id entries defined on the parent board. */
  labelIds: z.array(z.string()).default([]),
  /** ISO date (YYYY-MM-DD). Date-only on purpose: due dates are not time-zone sensitive. */
  dueDate: z.iso.date().nullable().default(null),
  type: CardTypeSchema.default('task'),
  priority: PrioritySchema.nullable().default(null),
  /** Relative size estimate (Scrum). Null means "not refined yet". */
  storyPoints: StoryPointsSchema.nullable().default(null),
  /** When the card last changed column (null: never moved, use createdAt). Drives the "stale" look. */
  movedAt: z.iso.datetime().nullable().default(null),
  /** Last cross-column moves (newest last, max 5). Drives the "hot" look. */
  moveLog: z.array(z.iso.datetime()).max(MOVE_LOG_SIZE).default([]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Card = z.infer<typeof CardSchema>;

export const ColumnSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(60),
  /**
   * Work-in-progress limit (Lean / Kanban). Null means unlimited. The UI
   * warns when a column goes over it: stop starting, start finishing.
   */
  wipLimit: z.number().int().positive().max(99).nullable().default(null),
  /** Ordered: array position is the visual position. */
  cards: z.array(CardSchema),
});
export type Column = z.infer<typeof ColumnSchema>;

/**
 * A board is stored as one aggregate document (columns + cards nested).
 * Boards are small, and this keeps moves atomic: one write, no ordering
 * fields to rebalance.
 */
export const BoardSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  profile: ProfileSchema,
  mode: BoardModeSchema.default('personal'),
  /**
   * Team boards only: secret shared through the invite link. It names and
   * encrypts the real-time room, so only people with the link can join.
   */
  shareKey: z.string().min(16).nullable().default(null),
  /** Template the board was created from, kept for analytics / "reset to template". */
  templateId: z.string().nullable().default(null),
  labels: z.array(LabelSchema).default([]),
  /**
   * Description given to every new card on this board, e.g. the Scrum user
   * story template ("Como… Necesito… Para que…" + Gherkin criteria).
   */
  cardTemplate: z.string().max(10_000).nullable().default(null),
  columns: z.array(ColumnSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Board = z.infer<typeof BoardSchema>;

/** Editable card fields (everything except identity and timestamps). */
export const CardPatchSchema = CardSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();
export type CardPatch = z.infer<typeof CardPatchSchema>;
