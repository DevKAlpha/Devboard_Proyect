import type { LinkProvider } from '../../integrations/links';

/** Each service's own color, so a chip is recognized at a glance. */
const COLOR: Record<LinkProvider, string> = {
  google: '#4285f4',
  microsoft: '#0078d4',
  slack: '#e01e5a',
  github: '#8957e5',
  web: 'var(--faint)',
};

/** Pixel mark of a service: a small block in its color (no brand logos). */
export function ProviderMark({ provider, size = 10 }: { provider: LinkProvider; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: size,
        height: size,
        background: COLOR[provider],
        // A hard inner shade keeps it pixel-looking rather than a flat dot.
        boxShadow: 'inset -2px -2px 0 rgb(0 0 0 / 0.25)',
      }}
    />
  );
}
