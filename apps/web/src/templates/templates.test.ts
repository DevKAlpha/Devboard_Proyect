import { describe, expect, it } from 'vitest';
import { BoardSchema } from '@devbord/shared';
import { TEMPLATES, buildBoardFromTemplate, templatesFor } from './index';

describe('templates', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s builds a valid board', (_id, template) => {
    const board = buildBoardFromTemplate(template);
    expect(BoardSchema.safeParse(board).success).toBe(true);
    expect(board.columns.map((c) => c.title)).toEqual(template.columns);
    expect(board.columns.flatMap((c) => c.cards)).toHaveLength(template.cards.length);
  });

  it('resolves label names to label ids', () => {
    const board = buildBoardFromTemplate(TEMPLATES.find((t) => t.id === 'dev-sprint')!);
    const ids = new Set(board.labels.map((l) => l.id));
    for (const card of board.columns.flatMap((c) => c.cards)) {
      card.labelIds.forEach((id) => expect(ids.has(id)).toBe(true));
    }
  });

  it('offers the blank template to every profile', () => {
    expect(templatesFor('technical').some((t) => t.id === 'blank')).toBe(true);
    expect(templatesFor('simple').some((t) => t.id === 'blank')).toBe(true);
  });
});
