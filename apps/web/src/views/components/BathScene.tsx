/**
 * Home page background: a bathtub seen from the front, in pixel art. A tiled
 * wall, the tub, moving water, and one rubber duck per person or agent using
 * Devbord right now (controllers/lobbyController), floating on the surface.
 *
 * The scene fills the page behind the content (a fixed canvas where one cell
 * is one pixel-art pixel, scaled up with crisp edges). Physics live in
 * bathPhysics.ts. The pointer plays too, wherever the page has no control
 * under it: brushing the surface makes waves, a click in the water splashes,
 * and a duck can be grabbed, lifted and thrown (it falls back with a splash).
 * In lite motion mode the scene is a still picture.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useLobby } from '../../controllers/lobbyController';
import { useMotion } from '../../controllers/motionController';
import { useCursorController } from '../../controllers/cursorController';
import { DUCK_COLORS, DUCK_GRID } from '../../design/duck';
import {
  Bath,
  MAX_DUCKS,
  MAX_SPEED,
  type BathDuck,
  type DuckKind,
  type DuckSeed,
} from './bathPhysics';
import './bath.css';

/** Screen pixels per cell. */
const CELL = 3;
const STEP_MS = 1000 / 60;
/** Our own duck has a fixed id: it exists before (and without) a connection. */
const SELF = 'self';
/** Size of a wall tile, in cells. */
const TILE = 14;
/** Page elements the scene never steals the pointer from. */
const CONTROLS =
  'a, button, input, select, textarea, label, dialog, [role="dialog"], [contenteditable="true"], header';

const COLORS = {
  tileA: '#161a23',
  tileB: '#1a1f2b',
  tub: '#1d2535',
  tubRim: '#2e3a52',
  tubShine: '#3d4b68',
  water: 'rgb(62 190 220 / 0.6)',
  deep: 'rgb(6 36 64 / 0.22)',
  surface: '#b9f3ff',
  foam: 'rgb(255 255 255 / 0.35)',
  drop: '#c9f6ff',
  bubble: 'rgb(210 248 255 / 0.75)',
};

/** Agents are robot ducks: cool metal body and a red antenna light. */
const AGENT_COLORS: Record<string, string> = {
  ...DUCK_COLORS,
  o: '#183a55',
  y: '#a8dcff',
  s: '#6cb6e8',
  w: '#f2fbff',
  r: '#ff5d5d',
};
const AGENT_GRID = DUCK_GRID.map((row, y) =>
  y === 0
    ? row.slice(0, 10) + 'r' + row.slice(11)
    : y === 1
      ? row.slice(0, 10) + 'o' + row.slice(11)
      : row,
);

/** Pre-renders one 16×16 duck sprite (looking right, or mirrored). */
function sprite(kind: DuckKind, facing: 1 | -1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const grid = kind === 'agent' ? AGENT_GRID : DUCK_GRID;
  const colors = kind === 'agent' ? AGENT_COLORS : DUCK_COLORS;
  grid.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const fill = colors[ch];
      if (!fill) return;
      ctx.fillStyle = fill;
      ctx.fillRect(facing === 1 ? x : 15 - x, y, 1, 1);
    }),
  );
  return canvas;
}

/** The still part of the scene (tiled wall and tub), drawn once per size. */
function backdrop(w: number, h: number, level: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  for (let ty = 0; ty * TILE < h; ty++) {
    for (let tx = 0; tx * TILE < w; tx++) {
      ctx.fillStyle = (tx + ty) % 2 ? COLORS.tileA : COLORS.tileB;
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  // The inside of the tub, above and behind the water, with its rim.
  const rim = level - 22;
  ctx.fillStyle = COLORS.tub;
  ctx.fillRect(0, rim, w, h - rim);
  ctx.fillStyle = COLORS.tubRim;
  ctx.fillRect(0, rim, w, 3);
  ctx.fillStyle = COLORS.tubShine;
  ctx.fillRect(0, rim, w, 1);
  return canvas;
}

/** Everyone online, us first; the scene shows up to MAX_DUCKS of them. */
function useDucks() {
  const selfId = useLobby((s) => s.selfId);
  const peers = useLobby((s) => s.peers);
  return useMemo<DuckSeed[]>(
    () => [
      { id: SELF, kind: 'user', self: true },
      ...Object.entries(peers)
        .filter(([id]) => id !== selfId)
        .map(([id, kind]) => ({ id, kind, self: false })),
    ],
    [peers, selfId],
  );
}

/** One line for the page header: how many ducks are in the water. */
export function BathCaption() {
  const count = useDucks().length;
  const extra = Math.max(0, count - MAX_DUCKS);
  return (
    <p className="mt-1 text-sm text-faint">
      <span className="text-muted tabular-nums">{count}</span> {count === 1 ? 'patito' : 'patitos'}{' '}
      en la bañera, uno por persona o agente conectado
      {extra > 0 ? ` (+${extra} esperando turno)` : ''}. El tuyo lleva la marca.
    </p>
  );
}

export function BathScene() {
  const everyone = useDucks();
  const shown = useMemo(() => everyone.slice(0, MAX_DUCKS), [everyone]);
  const lite = useMotion((s) => s.lite);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bathRef = useRef<Bath | null>(null);
  const seedsRef = useRef<DuckSeed[]>([]);
  const drawRef = useRef<() => void>(() => {});

  // The page shows the scene instead of its flat background while it is mounted.
  useEffect(() => {
    document.documentElement.dataset.scene = 'bath';
    return () => {
      delete document.documentElement.dataset.scene;
    };
  }, []);

  // People come and go: ducks drop in and hop out. (Runs before the bath is
  // built on mount, so the first bath already has everyone.)
  useEffect(() => {
    seedsRef.current = shown;
    bathRef.current?.sync(shown);
    drawRef.current();
  }, [shown]);

  // Build the bath for the viewport size, and again when the window resizes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const sprites = {
      user: { 1: sprite('user', 1), [-1]: sprite('user', -1) },
      agent: { 1: sprite('agent', 1), [-1]: sprite('agent', -1) },
    };
    const accent = getComputedStyle(canvas).getPropertyValue('--accent').trim() || '#7d7aff';

    const build = () => {
      const w = Math.ceil(window.innerWidth / CELL);
      const h = Math.ceil(window.innerHeight / CELL);
      canvas.width = w;
      canvas.height = h;
      const bath = new Bath(w, h);
      bath.sync(seedsRef.current);
      // Start with the ducks already afloat (no drop-in on every page visit).
      for (const d of bath.ducks) d.y = bath.level + 1;
      bathRef.current = bath;
      const still = backdrop(w, h, bath.level);

      drawRef.current = () => {
        ctx.drawImage(still, 0, 0);
        // Ducks first: the water drawn over them tints the part under the surface.
        for (const d of bath.ducks) {
          const x = Math.round(d.x - 8);
          const y = Math.round(d.y - 12);
          ctx.drawImage(sprites[d.kind][d.facing], x, y);
          if (d.self) {
            // A small marker over our own duck: "this one is you".
            ctx.fillStyle = accent;
            ctx.fillRect(x + 6, y - 6, 5, 1);
            ctx.fillRect(x + 7, y - 5, 3, 1);
            ctx.fillRect(x + 8, y - 4, 1, 1);
          }
        }
        ctx.fillStyle = COLORS.bubble;
        for (const b of bath.bubbles) ctx.fillRect(Math.round(b.x), Math.round(b.y), 2, 2);

        // Water, column by column under the moving surface, then depth bands.
        ctx.fillStyle = COLORS.water;
        for (let x = 0; x < w; x++) {
          const top = Math.round(bath.surfaceAt(x));
          ctx.fillRect(x, top, 1, h - top);
        }
        ctx.fillStyle = COLORS.deep;
        ctx.fillRect(0, bath.level + 18, w, h);
        ctx.fillRect(0, bath.level + 42, w, h);
        for (let x = 0; x < w; x++) {
          const top = Math.round(bath.surfaceAt(x));
          ctx.fillStyle = COLORS.surface;
          ctx.fillRect(x, top, 1, 1);
          ctx.fillStyle = COLORS.foam;
          ctx.fillRect(x, top + 1, 1, 1);
        }
        ctx.fillStyle = COLORS.drop;
        for (const p of bath.drops) ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      };
      drawRef.current();
    };

    build();
    window.addEventListener('resize', build);
    return () => {
      window.removeEventListener('resize', build);
      bathRef.current = null;
    };
  }, []);

  // The loop: fixed 60 steps per second, drawn once per frame. Off in lite mode.
  useEffect(() => {
    if (lite) {
      drawRef.current();
      return;
    }
    let raf = 0;
    let last = performance.now();
    let pending = 0;
    const tick = (now: number) => {
      // Cap the catch-up after a background tab, so the bath does not fast-forward.
      pending = Math.min(pending + (now - last), STEP_MS * 4);
      last = now;
      const bath = bathRef.current;
      if (bath) {
        while (pending >= STEP_MS) {
          bath.step();
          pending -= STEP_MS;
        }
        drawRef.current();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lite]);

  // Pointer play, on the whole page wherever there is no control under it.
  useEffect(() => {
    if (lite) return;
    let held: { duck: BathDuck; x: number; y: number; vx: number; vy: number } | null = null;
    let last: { x: number; y: number } | null = null;
    const body = document.body;
    const free = (e: PointerEvent) =>
      !document.querySelector('dialog[open]') &&
      !(e.target instanceof Element && e.target.closest(CONTROLS));
    const cells = (e: PointerEvent) => ({ x: e.clientX / CELL, y: e.clientY / CELL });

    const onMove = (e: PointerEvent) => {
      const bath = bathRef.current;
      if (!bath) return;
      const p = cells(e);
      if (held) {
        // Remember the hand speed: letting go throws the duck with it.
        held.vx = p.x - held.x;
        held.vy = p.y - held.y;
        held.x = p.x;
        held.y = p.y;
        held.duck.x = Math.min(bath.w - 7, Math.max(7, p.x));
        held.duck.y = Math.min(bath.h - 2, Math.max(14, p.y + 5));
        if (Math.abs(held.vx) > 0.2) held.duck.facing = held.vx > 0 ? 1 : -1;
        return;
      }
      const over = free(e) && bath.duckAt(p.x, p.y);
      if (over) body.dataset.cursor = 'grab';
      else if (body.dataset.cursor === 'grab') delete body.dataset.cursor;
      // A hand brushing the surface pushes the water along.
      if (last && free(e) && Math.abs(p.y - bath.surfaceAt(p.x)) < 4) {
        bath.splash(
          p.x,
          Math.max(-1, Math.min(1, (p.y - last.y) * 0.3 + Math.abs(p.x - last.x) * 0.05)),
          3,
        );
      }
      last = p;
    };

    const onDown = (e: PointerEvent) => {
      const bath = bathRef.current;
      if (!bath || e.button !== 0 || !free(e)) return;
      const p = cells(e);
      const duck = bath.duckAt(p.x, p.y);
      if (duck) {
        e.preventDefault(); // no text selection while carrying a duck
        duck.held = true;
        duck.vx = 0;
        duck.vy = 0;
        held = { duck, vx: 0, vy: 0, ...p };
        useCursorController.getState().drag(null);
      } else if (p.y > bath.surfaceAt(p.x)) {
        bath.splash(p.x, 2.5, 5);
        bath.spray(p.x, 8);
      }
    };

    const onUp = () => {
      if (!held) return;
      const clamp = (v: number) => Math.max(-MAX_SPEED, Math.min(MAX_SPEED, v));
      held.duck.held = false;
      held.duck.vx = clamp(held.vx);
      held.duck.vy = clamp(held.vy);
      held = null;
      useCursorController.getState().endDrag();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (body.dataset.cursor === 'grab') delete body.dataset.cursor;
      if (held) useCursorController.getState().endDrag();
    };
  }, [lite]);

  return <canvas ref={canvasRef} className="bath-canvas" aria-hidden />;
}
