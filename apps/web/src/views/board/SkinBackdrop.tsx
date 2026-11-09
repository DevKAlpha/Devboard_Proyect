/**
 * Scenery behind a skinned board (design/skins.css): a moon, stars and bats
 * for Halloween; a string of lights and snowfall for Navidad. Decorative and
 * click-through. Fixed positions (no randomness), so it looks the same on
 * every visit and never re-renders.
 */
import { memo, type CSSProperties } from 'react';
import type { BoardSkin } from '@devbord/shared';

const STARS = [
  [8, 14],
  [17, 30],
  [29, 9],
  [41, 22],
  [55, 12],
  [63, 34],
  [74, 8],
  [91, 26],
] as const;
/** [top (vh), seconds to cross, delay, resting x for lite mode] */
const BATS = [
  [18, 19, -3, 22],
  [32, 26, -14, 58],
  [12, 23, -9, 80],
  [46, 31, -22, 36],
] as const;
const BULBS = ['#ff4d5e', '#ffd23f', '#3ad07a', '#4db5ff'];
const FLAKES = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 37) % 100,
  duration: 11 + (i % 5) * 2.5,
  delay: -((i * 7) % 17),
  rest: 10 + ((i * 29) % 80),
}));

export const SkinBackdrop = memo(function SkinBackdrop({ skin }: { skin: BoardSkin }) {
  if (skin === 'halloween') {
    return (
      <div className="skin-backdrop" aria-hidden>
        {STARS.map(([x, y]) => (
          <span
            key={`${x}-${y}`}
            className="skin-star"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${-x / 10}s` }}
          />
        ))}
        <span className="skin-moon" />
        {BATS.map(([top, duration, delay, rest]) => (
          <span
            key={top}
            className="skin-bat"
            style={
              {
                top: `${top}vh`,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
                '--rest-x': `${rest}vw`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    );
  }
  if (skin === 'christmas') {
    return (
      <div className="skin-backdrop" aria-hidden>
        <div className="skin-lights">
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              className="skin-bulb"
              style={
                {
                  '--bulb': BULBS[i % BULBS.length],
                  animationDelay: `${(i % 3) * -0.55}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        {FLAKES.map((f, i) => (
          <span
            key={i}
            className="skin-flake"
            style={
              {
                left: `${f.left}%`,
                animationDuration: `${f.duration}s`,
                animationDelay: `${f.delay}s`,
                '--rest-y': `${f.rest}vh`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    );
  }
  return null;
});
