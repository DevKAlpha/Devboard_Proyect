import { describe, expect, it } from 'vitest';
import { cardMood, describeMood } from './cardMood';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-08T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const card = (
  over: Partial<{ createdAt: string; movedAt: string | null; moveLog: string[] }> = {},
) => ({
  createdAt: ago(DAY),
  movedAt: null,
  moveLog: [],
  ...over,
});
const col = (title: string) => ({ title });

describe('cardMood', () => {
  it('is calm for recent, normal work', () => {
    expect(cardMood(card(), col('To Do'), false, NOW)).toBeNull();
  });

  it('freezes anything in an icebox column', () => {
    expect(cardMood(card({ createdAt: ago(30 * DAY) }), col('Icebox'), false, NOW)).toBe('frozen');
    expect(cardMood(card(), col('Congelado'), false, NOW)).toBe('frozen');
  });

  it('gathers cobwebs after 7 days without changing column, more after 14', () => {
    expect(cardMood(card({ createdAt: ago(8 * DAY) }), col('Doing'), false, NOW)).toBe('stale');
    expect(cardMood(card({ movedAt: ago(15 * DAY) }), col('Doing'), false, NOW)).toBe('stale2');
  });

  it('never puts cobwebs on finished work (last column)', () => {
    expect(cardMood(card({ createdAt: ago(60 * DAY) }), col('Done'), true, NOW)).toBeNull();
  });

  it('heats up with 3+ column changes in 2 days', () => {
    const moveLog = [ago(30 * 3600e3), ago(5 * 3600e3), ago(3600e3)];
    expect(cardMood(card({ moveLog, movedAt: moveLog[2] }), col('Review'), false, NOW)).toBe('hot');
    const old = [ago(5 * DAY), ago(4 * DAY), ago(3600e3)];
    expect(cardMood(card({ moveLog: old, movedAt: old[2] }), col('Review'), false, NOW)).toBeNull();
  });

  it('describes the mood for tooltips and screen readers', () => {
    expect(describeMood('stale', card({ movedAt: ago(9 * DAY) }), NOW)).toBe(
      'Sin avanzar desde hace 9 días',
    );
    expect(describeMood(null, card(), NOW)).toBeNull();
  });
});
