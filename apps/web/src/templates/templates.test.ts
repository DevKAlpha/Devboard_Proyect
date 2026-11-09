import { describe, expect, it } from 'vitest';
import { BoardSchema } from '@devbord/shared';
import {
  TEMPLATES,
  USER_STORY_TEMPLATE,
  buildBoardFromTemplate,
  getTemplate,
  templatesFor,
} from './index';
import { previewText } from '../views/board/cardMeta';

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

  it('seasonal templates start the board with their skin, for every profile', () => {
    for (const id of ['halloween', 'christmas'] as const) {
      expect(buildBoardFromTemplate(getTemplate(id)!).skin).toBe(id);
      expect(templatesFor('technical').some((t) => t.id === id)).toBe(true);
    }
    expect(buildBoardFromTemplate(getTemplate('scrum')!).skin).toBe('default');
  });

  it('offers the blank template to every profile', () => {
    expect(templatesFor('technical').some((t) => t.id === 'blank')).toBe(true);
    expect(templatesFor('simple').some((t) => t.id === 'blank')).toBe(true);
  });
});

describe('scrum template', () => {
  const scrum = getTemplate('scrum')!;

  it('is the default choice for technical profiles', () => {
    expect(templatesFor('technical')[0]!.id).toBe('scrum');
  });

  it('builds a valid board with WIP limits and the user story template', () => {
    const board = buildBoardFromTemplate(scrum);
    expect(BoardSchema.safeParse(board).success).toBe(true);
    expect(board.cardTemplate).toBe(USER_STORY_TEMPLATE);
    const wip = Object.fromEntries(board.columns.map((c) => [c.title, c.wipLimit]));
    expect(board.columns.map((c) => c.title)).toEqual([
      'New issues',
      'Icebox',
      'Product Backlog',
      'Sprint Backlog',
      'In progress',
      'In review',
      'Done',
    ]);
    expect(wip['In progress']).toBe(3);
    expect(wip['Product Backlog']).toBe(5);
    expect(wip['In review']).toBe(5);
    expect(board.columns[4]!.description).toBe('Se está trabajando activamente');
    // Example cards are numbered like GitHub issues.
    expect(board.columns.flatMap((c) => c.cards).every((c) => c.number !== null)).toBe(true);
    expect(board.labels.map((l) => l.name)).toEqual(['enhancement', 'bug', 'technical debt']);
  });

  it('previews the story without Markdown noise', () => {
    expect(previewText(USER_STORY_TEMPLATE)).toMatch(/^Como \[rol\] · Necesito \[función\]/);
    expect(previewText(USER_STORY_TEMPLATE)).not.toMatch(/\*\*|```|###/);
  });
});
