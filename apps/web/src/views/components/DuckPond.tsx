/**
 * Home page bathtub: one rubber duck per person or agent using Devbord right
 * now (controllers/lobbyController), floating on water that moves.
 *
 * Drawn on a small canvas where one cell is one pixel-art pixel, scaled up
 * with crisp edges, so the water and the ducks share the pixel look. Physics
 * live in pondPhysics.ts. The pointer plays too: hovering stirs the water, a
 * click splashes, and a duck can be grabbed and thrown into the others.
 * In lite motion mode the tub is a still picture.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useLobby } from '../../controllers/lobbyController';
import { useMotion } from '../../controllers/motionController';
import { useCursorController } from '../../controllers/cursorController';
import { DUCK_COLORS, DUCK_GRID } from '../../design/duck';
import {
  MAX_DUCKS,
  MAX_SPEED,
  Pond,
  type DuckKind,
  type DuckSeed,
  type PondDuck,
} from './pondPhysics';
import './pond.css';

/** Screen pixels per water cell. */
const CELL = 3;
const STEP_MS = 1000 / 60;
/** Our own duck has a fixed id: it exists before (and without) a connection. */
const SELF = 'self';

/** Water shades from crest-lit to trough, as packed RGBA for ImageData. */
const WATER = ['#e9fbff', '#8fe1f7', '#4cc4ec', '#33a6d6', '#2386bb'];

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

/** "#rrggbb" to the 32-bit little-endian ABGR value ImageData stores. */
const packed = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0xff << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff);
};

export function DuckPond() {
  const selfId = useLobby((s) => s.selfId);
  const peers = useLobby((s) => s.peers);
  const lite = useMotion((s) => s.lite);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pondRef = useRef<Pond | null>(null);
  const [cells, setCells] = useState({ w: 0, h: 0 });
  const grab = useRef<{ duck: PondDuck; vx: number; vy: number; x: number; y: number } | null>(
    null,
  );
  const drawRef = useRef<() => void>(() => {});

  // Everyone online, us first; the pond shows up to MAX_DUCKS of them.
  const everyone = useMemo<DuckSeed[]>(
    () => [
      { id: SELF, kind: 'user', self: true },
      ...Object.entries(peers)
        .filter(([id]) => id !== selfId)
        .map(([id, kind]) => ({ id, kind, self: false })),
    ],
    [peers, selfId],
  );
  const shown = useMemo(() => everyone.slice(0, MAX_DUCKS), [everyone]);
  const extra = everyone.length - shown.length;
  const seedsRef = useRef<DuckSeed[]>([]);

  // People come and go: ducks drop in and hop out. (Runs before the pond is
  // built on mount, so the first pond already has everyone.)
  useEffect(() => {
    seedsRef.current = shown;
    pondRef.current?.sync(shown);
    drawRef.current();
  }, [shown]);

  // The tub follows the layout width; a new size starts a fresh pond.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      setCells({ w: Math.floor(width / CELL), h: Math.floor(height / CELL) });
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Build the pond and its renderer for the current size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cells.w < 8 || cells.h < 8) return;
    canvas.width = cells.w;
    canvas.height = cells.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pond = new Pond(cells.w, cells.h);
    pond.sync(seedsRef.current);
    pondRef.current = pond;

    const image = ctx.createImageData(cells.w, cells.h);
    const pixels = new Uint32Array(image.data.buffer);
    const shades = WATER.map(packed);
    const sprites = {
      user: { 1: sprite('user', 1), [-1]: sprite('user', -1) },
      agent: { 1: sprite('agent', 1), [-1]: sprite('agent', -1) },
    };
    const accent = getComputedStyle(canvas).getPropertyValue('--accent').trim() || '#7d7aff';

    drawRef.current = () => {
      const { w, h } = pond;
      // Water: light comes from the top-left, so slopes facing it are brighter.
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const s =
            pond.height(x - 1, y) -
            pond.height(x + 1, y) +
            pond.height(x, y - 1) -
            pond.height(x, y + 1);
          const level = s > 1.4 ? 0 : s > 0.35 ? 1 : s > -0.35 ? 2 : s > -1.4 ? 3 : 4;
          pixels[y * w + x] = shades[level]!;
        }
      }
      ctx.putImageData(image, 0, 0);

      // Ducks, back to front, bobbing with the water under them.
      const ducks = [...pond.ducks].sort((a, b) => a.y - b.y);
      for (const d of ducks) {
        const bob = d.held
          ? -3
          : -Math.max(-2, Math.min(2, Math.round(pond.height(d.x, d.y) * 0.35)));
        const x = Math.round(d.x - 8);
        const y = Math.round(d.y - 12 + bob);
        // Soft shadow on the water (larger and lighter while lifted).
        ctx.fillStyle = 'rgb(10 50 90 / 0.28)';
        const lift = d.held ? 4 : 0;
        ctx.fillRect(x + 2 - lift / 2, Math.round(d.y) + 2 + lift, 12 + lift, 1);
        ctx.fillRect(x + 3 - lift / 2, Math.round(d.y) + 3 + lift, 10 + lift, 1);
        ctx.drawImage(sprites[d.kind][d.facing], x, y);
        if (d.self) {
          // A small marker over our own duck: "this one is you".
          ctx.fillStyle = accent;
          ctx.fillRect(x + 6, y - 5, 5, 1);
          ctx.fillRect(x + 7, y - 4, 3, 1);
          ctx.fillRect(x + 8, y - 3, 1, 1);
        }
      }
    };

    // Let the drop-in splashes spread a little before the first picture.
    for (let i = 0; i < 20; i++) pond.step();
    drawRef.current();
    return () => {
      pondRef.current = null;
    };
  }, [cells]);

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
      // Cap the catch-up after a background tab, so the pond does not fast-forward.
      pending = Math.min(pending + (now - last), STEP_MS * 4);
      last = now;
      const pond = pondRef.current;
      if (pond) {
        while (pending >= STEP_MS) {
          pond.step();
          pending -= STEP_MS;
        }
        drawRef.current();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lite]);

  const toCells = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pond = pondRef.current!;
    return {
      x: ((e.clientX - rect.left) / rect.width) * pond.w,
      y: ((e.clientY - rect.top) / rect.height) * pond.h,
    };
  };

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const pond = pondRef.current;
    if (!pond || lite) return;
    const p = toCells(e);
    const held = grab.current;
    if (held) {
      // Remember the hand speed: letting go throws the duck with it.
      held.vx = p.x - held.x;
      held.vy = p.y - held.y;
      held.x = p.x;
      held.y = p.y;
      held.duck.x = Math.min(pond.w - 6, Math.max(6, p.x));
      held.duck.y = Math.min(pond.h - 6, Math.max(10, p.y + 4));
      if (Math.abs(held.vx) > 0.2) held.duck.facing = held.vx > 0 ? 1 : -1;
      return;
    }
    // A finger trailing through the water.
    pond.disturb(p.x, p.y, 1.2, 1.5);
    e.currentTarget.dataset.cursor = pond.duckAt(p.x, p.y) ? 'grab' : 'default';
  };

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const pond = pondRef.current;
    if (!pond || lite || e.button !== 0) return;
    const p = toCells(e);
    const duck = pond.duckAt(p.x, p.y);
    if (!duck) {
      pond.disturb(p.x, p.y, 14, 3); // splash
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    duck.held = true;
    duck.vx = 0;
    duck.vy = 0;
    grab.current = { duck, vx: 0, vy: 0, ...p };
    useCursorController.getState().drag(null);
  };

  const onUp = () => {
    const held = grab.current;
    if (!held) return;
    grab.current = null;
    const clamp = (v: number) => Math.max(-MAX_SPEED, Math.min(MAX_SPEED, v));
    held.duck.held = false;
    held.duck.vx = clamp(held.vx);
    held.duck.vy = clamp(held.vy);
    pondRef.current?.disturb(held.duck.x, held.duck.y, 10, 3); // plop
    useCursorController.getState().endDrag();
  };

  const count = everyone.length;
  return (
    <section aria-label="Quién está usando Devbord ahora" className="flex flex-col gap-2">
      {/* The tub: enamel rim with pixel tiles, water inside. */}
      <div className="pond-tub rounded-2xl p-2">
        <div ref={wrapRef} className="relative h-44 overflow-hidden rounded-xl sm:h-52">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Estanque con ${count} ${count === 1 ? 'patito' : 'patitos'}: uno por cada persona o agente usando Devbord ahora mismo.`}
            className="pond-water absolute inset-0 h-full w-full touch-none"
            onPointerMove={onMove}
            onPointerDown={onDown}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
        <span className="text-ink tabular-nums">{count}</span>
        {count === 1 ? 'patito en el agua' : 'patitos en el agua'}: personas y agentes usando
        Devbord ahora mismo.
        {extra > 0 && <span className="tabular-nums">(+{extra} fuera de la bañera)</span>}
        <span className="text-faint">Tu patito lleva la marca. Agárralo y lánzalo.</span>
      </p>
    </section>
  );
}
