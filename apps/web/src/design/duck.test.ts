import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DUCK_COLORS, DUCK_GRID, duckSvg } from './duck';

describe('pixel duck', () => {
  it('is a 16×16 grid that only uses known colors', () => {
    expect(DUCK_GRID).toHaveLength(16);
    for (const row of DUCK_GRID) {
      expect(row).toHaveLength(16);
      for (const ch of row) expect(ch === '.' || ch in DUCK_COLORS).toBe(true);
    }
  });

  it('matches the favicon (regenerate public/favicon.svg with duckSvg after editing)', () => {
    const favicon = readFileSync(resolve(__dirname, '../../public/favicon.svg'), 'utf8');
    expect(favicon).toBe(duckSvg());
  });
});
