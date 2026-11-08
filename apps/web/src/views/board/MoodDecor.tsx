/**
 * Pixel-art decorations for a card's mood (see cardMood.ts):
 * cobwebs + spider (stale), flames (hot), frost + sparkles (frozen).
 *
 * Purely decorative (aria-hidden, pointer-events none); the meaning is also
 * given as text by the card's title/aria description. Sprites are generated
 * once at module load, so rendering is just a few cached <rect>s.
 */
import type { CardMood } from './cardMood';
import './moods.css';

type Px = readonly [number, number];

/** Cobweb anchored in the top-right corner: radial threads + three arcs. */
function cobwebPixels(size: number): Px[] {
  const set = new Set<string>();
  const add = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < size && y < size) set.add(`${x},${y}`);
  };
  const cx = size - 1;
  // Threads from the corner: left edge, diagonal, down edge, and two in between.
  for (const deg of [0, 25, 45, 65, 90]) {
    const rad = (deg * Math.PI) / 180;
    for (let r = 0; r < size * 1.2; r += 0.5) {
      add(Math.round(cx - r * Math.cos(rad)), Math.round(r * Math.sin(rad)));
    }
  }
  // Sagging arcs between threads.
  for (const radius of [size * 0.3, size * 0.58, size * 0.85]) {
    for (let deg = 0; deg <= 90; deg += 3) {
      const rad = (deg * Math.PI) / 180;
      const sag = Math.sin(((deg % 22.5) / 22.5) * Math.PI) * 0.8;
      add(
        Math.round(cx - (radius - sag) * Math.cos(rad)),
        Math.round((radius - sag) * Math.sin(rad)),
      );
    }
  }
  return [...set].map((k) => k.split(',').map(Number) as unknown as Px);
}

const WEB_SMALL = cobwebPixels(14);
const WEB_LARGE = cobwebPixels(22);

function Cobweb({ pixels, size, className }: { pixels: Px[]; size: number; className: string }) {
  return (
    <svg
      className={className}
      width={size * 2}
      height={size * 2}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
    >
      {pixels.map(([x, y]) => (
        <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill="var(--mood-web)" />
      ))}
    </svg>
  );
}

/** 5×4 spider hanging from a thread (only on very stale cards). */
const SPIDER = ['.o.o.', 'ooooo', '.ooo.', 'o.o.o'];

function Spider() {
  return (
    <span className="mood-spider">
      <span className="mood-spider-thread" />
      <svg width={10} height={8} viewBox="0 0 5 4" shapeRendering="crispEdges">
        {SPIDER.flatMap((row, y) =>
          [...row].map((ch, x) =>
            ch === 'o' ? (
              <rect key={`${x}${y}`} x={x} y={y} width={1} height={1} fill="var(--ink)" />
            ) : null,
          ),
        )}
      </svg>
    </span>
  );
}

/** Two-frame pixel flame; frames swap with a stepped animation (CSS). */
const FLAME_A = [
  '...r...',
  '..ror..',
  '..ror..',
  '.royor.',
  '.royyr.',
  'roYYyor',
  'royYYor',
  '.roooo.',
];
const FLAME_B = [
  '..r....',
  '..rr...',
  '.ror.r.',
  '.royor.',
  'royyyr.',
  'royYYor',
  'roYYyor',
  '.roooo.',
];
const FLAME_COLOR: Record<string, string> = {
  r: '#e8461f',
  o: '#ff8a1f',
  y: '#ffc93c',
  Y: '#fff3b0',
};

function FlameFrame({ grid, className }: { grid: string[]; className: string }) {
  return (
    <g className={className}>
      {grid.flatMap((row, y) =>
        [...row].map((ch, x) =>
          FLAME_COLOR[ch] ? (
            <rect key={`${x}${y}`} x={x} y={y} width={1} height={1} fill={FLAME_COLOR[ch]} />
          ) : null,
        ),
      )}
    </g>
  );
}

function Flame({ delay }: { delay: number }) {
  return (
    <svg
      className="mood-flame"
      style={{ animationDelay: `${delay}ms` }}
      width={21}
      height={24}
      viewBox="0 0 7 8"
      shapeRendering="crispEdges"
    >
      <FlameFrame grid={FLAME_A} className="mood-flame-a" />
      <FlameFrame grid={FLAME_B} className="mood-flame-b" />
    </svg>
  );
}

/** Frost crystal (pixel snowflake) used in corners and as twinkles. */
const FLAKE = ['..w..', 'w.w.w', '.www.', 'w.w.w', '..w..'];

function Flake({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      width={15}
      height={15}
      viewBox="0 0 5 5"
      shapeRendering="crispEdges"
    >
      {FLAKE.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === 'w' ? (
            <rect key={`${x}${y}`} x={x} y={y} width={1} height={1} fill="var(--mood-ice-ink)" />
          ) : null,
        ),
      )}
    </svg>
  );
}

/** Icicle (3 px wide) hanging from the top edge of a frozen card. */
const ICICLE = ['iii', 'iii', '.i.', '.i.', '.i.'];

function Icicles() {
  // Fixed positions/lengths: deterministic, so the card never "re-rolls" its look.
  const spots = [
    [8, 5],
    [22, 3],
    [37, 4],
    [55, 2],
    [71, 5],
    [88, 3],
  ] as const;
  return (
    <span className="mood-icicles">
      {spots.map(([left, len]) => (
        <svg
          key={left}
          style={{ left: `${left}%` }}
          width={6}
          height={len * 2}
          viewBox={`0 0 3 ${len}`}
          shapeRendering="crispEdges"
        >
          {ICICLE.slice(0, len).flatMap((row, y) =>
            [...row].map((ch, x) =>
              ch === 'i' ? (
                <rect
                  key={`${x}${y}`}
                  x={x}
                  y={y}
                  width={1}
                  height={1}
                  fill="var(--mood-ice-ink)"
                />
              ) : null,
            ),
          )}
        </svg>
      ))}
    </span>
  );
}

export function MoodDecor({ mood }: { mood: CardMood }) {
  if (!mood) return null;
  return (
    <span aria-hidden className="mood-layer">
      {(mood === 'stale' || mood === 'stale2') && (
        <>
          <Cobweb
            pixels={mood === 'stale2' ? WEB_LARGE : WEB_SMALL}
            size={mood === 'stale2' ? 22 : 14}
            className="mood-web mood-web-tr"
          />
          {mood === 'stale2' && (
            <>
              <Cobweb pixels={WEB_SMALL} size={14} className="mood-web mood-web-bl" />
              <Spider />
            </>
          )}
        </>
      )}
      {mood === 'hot' && (
        <span className="mood-flames">
          <Flame delay={0} />
          <Flame delay={140} />
          <Flame delay={70} />
        </span>
      )}
      {mood === 'frozen' && (
        <>
          <span className="mood-frost" />
          <Icicles />
          <Flake className="mood-flake mood-flake-tr" />
          <Flake className="mood-flake mood-flake-bl" />
          <Flake className="mood-twinkle" style={{ left: '62%', top: '18%' }} />
          <Flake
            className="mood-twinkle"
            style={{ left: '22%', top: '58%', animationDelay: '900ms' }}
          />
        </>
      )}
    </span>
  );
}
