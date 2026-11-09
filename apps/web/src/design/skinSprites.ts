/**
 * Pixel sprites of the seasonal board skins (witch hat, Santa hat, bats,
 * cobweb, snow…), drawn as text grids like the cursor and the duck so they
 * are easy to retouch. Each one is exposed as a CSS custom property
 * (`--sprite-witch-hat`, …) holding an SVG data URI, which design/skins.css
 * uses as background images. Installed once at startup (see installSkinSprites).
 */
const SPRITES: Record<string, { pal: Record<string, string>; grid: readonly string[] }> = {
  witchHat: {
    pal: { k: '#2a1438', K: '#4b2466', o: '#ff7a1a' },
    grid: [
      '........kk..',
      '.......kKk..',
      '......kKKk..',
      '......kKKk..',
      '.....kKKKk..',
      '.....kKKKKk.',
      '....kooooook',
      '....kKKKKKk.',
      'kkkkKKKKKKkk',
      'kKKKKKKKKKKk',
      '.kkkkkkkkkk.',
    ],
  },
  santaHat: {
    pal: { r: '#d62839', R: '#a3162a', w: '#ffffff', g: '#d9e4ea' },
    grid: [
      '.........ww.',
      '........wwww',
      '.......rRww.',
      '......rrR...',
      '.....rrrR...',
      '....rrrrrR..',
      '...rrrrrrR..',
      '..rrrrrrrrR.',
      '.wwwwwwwwwww',
      '.wggwwgwwggw',
      '..wwwwwwwww.',
    ],
  },
  cobweb: {
    pal: { w: 'rgba(255,255,255,0.55)', s: '#1a0b24', e: '#ff7a1a' },
    grid: [
      'wwwwwwwwwwwwwwww',
      '.w....w.....w..w',
      '..w...w....w...w',
      '...wwwwwwwww...w',
      '....w..w..w...ww',
      '.....w.w.w...w.w',
      '......wwwwwww..w',
      '.......w.w....ww',
      '........ww...w.w',
      '.........w..w..w',
      '..........ww...w',
      '...........w..ww',
      '............w.ws',
      '.............wss',
      '..............se',
      '...............w',
    ],
  },
  batA: {
    pal: { b: '#120818', e: '#ffb347' },
    grid: [
      'b..............b',
      'bb....b..b....bb',
      'bbb...bbbb...bbb',
      'bbbb.bebbeb.bbbb',
      'bbbbbbbbbbbbbbbb',
      '.bbb.bbbbbb.bbb.',
      '..b...bbbb...b..',
      '.......bb.......',
    ],
  },
  batB: {
    pal: { b: '#120818', e: '#ffb347' },
    grid: [
      '................',
      '......b..b......',
      '......bbbb......',
      '.....bebbeb.....',
      '..bbbbbbbbbbbb..',
      '.bbbbbbbbbbbbbb.',
      'bbb..bbbbbb..bbb',
      'b.....b..b.....b',
    ],
  },
  moon: {
    pal: { m: '#ffe9a8', M: '#f5d070', c: '#e0b850' },
    grid: [
      '.....mmmmmm.....',
      '...mmmmmmmmmm...',
      '..mmmmmmmmmmMm..',
      '.mmmcmmmmmmmMMm.',
      '.mmccmmmmmmmmMm.',
      'mmmmmmmmmcmmmMMm',
      'mmmmmmmmmmmmmMMm',
      'mmmmmmmmmmmmmMMm',
      'mmmmmcmmmmmmmMMm',
      'mmmmccmmmmmmMMMm',
      '.mmmmmmmmmcmMMm.',
      '.mmmmmmmmmmMMMm.',
      '..mmmmmmmmMMMm..',
      '...mmmmmMMMMm...',
      '.....mmmmmmm....',
      '................',
    ],
  },
  snowCap: {
    pal: { w: '#ffffff', b: '#cfe3ef' },
    grid: [
      '..wwww......www.',
      '.wwwwwww...wwwww',
      'wwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwww',
      'bwwwbwwwwwbwwwwb',
      '.b.w..bwwb..b.w.',
      '...b...bw.......',
      '........b.......',
    ],
  },
  holly: {
    pal: { g: '#2f8f4e', G: '#1f6b38', r: '#e0283c' },
    grid: [
      'gg........gg',
      'gGgg....ggGg',
      '.gGGg..gGGg.',
      '..gGGrrGGg..',
      '.gGGgrrgGGg.',
      'gg....rr..gg',
    ],
  },
  flake: {
    pal: { w: '#ffffff', b: '#a9c9dd' },
    grid: ['..b.b..', '.bwbwb.', 'bwbwbwb', '.bwwwb.', 'bwbwbwb', '.bwbwb.', '..b.b..'],
  },
  pumpkin: {
    pal: { o: '#ff7a1a', O: '#c95400', g: '#3f8f3a', y: '#ffd23f', k: '#2a1438' },
    grid: [
      '......gg......',
      '.....gg.......',
      '..oooOoOooo...',
      '.ooOooOooOoo..',
      'ooyyoOoOyyooo.',
      'ooyyoOoOyyooo.',
      'oooooyyoooooo.',
      'ooyOoooooOyoo.',
      '.ooyyyyyyyoo..',
      '..oooOoOooo...',
    ],
  },
};

/** Grid to SVG data URI; horizontal runs of one color become one rect. */
export function spriteUri({ pal, grid }: { pal: Record<string, string>; grid: readonly string[] }) {
  const w = Math.max(...grid.map((r) => r.length));
  let rects = '';
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x]!;
      let end = x + 1;
      while (row[end] === ch) end++;
      const fill = pal[ch];
      if (fill) rects += `<rect x='${x}' y='${y}' width='${end - x}' height='1' fill='${fill}'/>`;
      x = end;
    }
  });
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${grid.length}' shape-rendering='crispEdges'>${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** camelCase sprite name to its CSS property, e.g. witchHat to --sprite-witch-hat. */
const property = (name: string) =>
  `--sprite-${name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;

/** Publishes every sprite as a CSS custom property on <html>. */
export function installSkinSprites() {
  const style = document.documentElement.style;
  for (const [name, sprite] of Object.entries(SPRITES))
    style.setProperty(property(name), spriteUri(sprite));
}
