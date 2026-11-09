/**
 * Devbord's mascot: a pixel rubber duck, a nod to "rubber duck debugging"
 * (explain the problem to the duck, line by line, and the answer shows up).
 * Used for the logo and the favicon (public/favicon.svg, kept in sync by a test).
 *
 * Legend: `o` outline · `y` body · `s` wing shade · `w` shine · `e` eye ·
 * `b` beak · `.` transparent. 16×16, drawn as text so it is easy to retouch.
 */
export const DUCK_GRID = [
  '................',
  '........oooo....',
  '.......oyyyyo...',
  '......oyywyyyo..',
  '......oyyyyeyobb',
  '......oyyyyyyobb',
  '......oyyyyyyo..',
  '.oo....oyyyyo...',
  'oyyo.ooyyyyyooo.',
  'oyyyoyyyyyyyyyyo',
  'oyyyyyssssyyyyyo',
  'oyyyyyyssssyyyyo',
  '.oyyyyyyyyyyyyo.',
  '..oyyyyyyyyyyo..',
  '...oooooooooo...',
  '................',
] as const;

export const DUCK_COLORS: Record<string, string> = {
  o: '#4a3300',
  y: '#ffd23f',
  s: '#f2a900',
  w: '#fff8d6',
  e: '#1d1d1f',
  b: '#ff8a1f',
};

/** Horizontal runs of one color, merged into single rects (keeps the SVG tiny). */
export function duckRects(): Array<{ x: number; y: number; w: number; fill: string }> {
  const rects: Array<{ x: number; y: number; w: number; fill: string }> = [];
  DUCK_GRID.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') rects.push({ x, y, w: end - x, fill: DUCK_COLORS[ch]! });
      x = end;
    }
  });
  return rects;
}

/** The duck as a standalone SVG document (the favicon). */
export function duckSvg(): string {
  const body = duckRects()
    .map((r) => `  <rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`)
    .join(String.fromCharCode(10));
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">',
    body,
    '</svg>',
    '',
  ].join(String.fromCharCode(10));
}
