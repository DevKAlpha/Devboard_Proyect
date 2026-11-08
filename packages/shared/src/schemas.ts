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
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Card = z.infer<typeof CardSchema>;

export const ColumnSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(60),
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
  /** Template the board was created from, kept for analytics / "reset to template". */
  templateId: z.string().nullable().default(null),
  labels: z.array(LabelSchema).default([]),
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
