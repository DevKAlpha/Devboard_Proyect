import { describe, expect, it } from 'vitest';
import { columnKind } from './columnKind';

describe('columnKind', () => {
  it.each([
    ['New issues', 'new'],
    ['Icebox', 'icebox'],
    ['Product Backlog', 'backlog'],
    ['Sprint Backlog', 'sprint'],
    ['In progress', 'progress'],
    ['In review', 'review'],
    ['Review/QA', 'review'],
    ['Done', 'done'],
    ['Por hacer', 'sprint'],
    ['Haciendo', 'progress'],
    ['Hecho', 'done'],
    ['Listo', 'done'],
    ['Nuevo', 'new'],
    ['Triaje', 'new'],
  ] as const)('%s → %s', (title, kind) => {
    expect(columnKind(title)).toBe(kind);
  });

  it('treats an unknown last column as done, other unknowns as generic', () => {
    expect(columnKind('Entregado', true)).toBe('done');
    expect(columnKind('Cosas')).toBe('generic');
  });
});
