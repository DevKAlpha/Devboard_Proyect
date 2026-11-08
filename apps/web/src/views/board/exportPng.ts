/**
 * Board snapshot as a PNG image, drawn on a <canvas>.
 *
 * Drawn by hand instead of screenshotting the DOM: the image always contains
 * every column (the on-screen board scrolls horizontally), it uses the pixel
 * font and the active theme colors, and it needs no extra library.
 */
import { PROFILE_FEATURES, type Board } from '@devbord/shared';
import { CARD_TYPE_META, PRIORITY_META, previewText } from './cardMeta';

const SCALE = 2; // Retina-crisp output.
const PAD = 32;
const COL_W = 280;
const COL_GAP = 16;
const COL_PAD = 10;
const CARD_PAD = 12;
const CARD_GAP = 10;
const FONT = '"Pixelify Sans", ui-monospace, monospace';

type Ctx = CanvasRenderingContext2D;

/** Reads the current theme tokens, so the image matches what the user sees. */
const themeColor = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim() || '#888';

/** Greedy word wrap; long words are cut. Returns at most `maxLines` lines. */
function wrap(ctx: Ctx, text: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && text.length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/.{0,2}$/, '')}…`;
  }
  return lines;
}

interface Chip {
  text: string;
  bg: string;
  fg: string;
}

interface CardLayout {
  chips: Chip[];
  title: string[];
  desc: string[];
  meta: Chip[];
  height: number;
}

const TITLE_LH = 18;
const DESC_LH = 16;
const CHIP_H = 18;

function layoutCards(ctx: Ctx, board: Board) {
  const features = PROFILE_FEATURES[board.profile];
  const inner = COL_W - COL_PAD * 2 - CARD_PAD * 2;
  const label = (color: string) => ({
    bg: themeColor(`label-${color}`),
    fg: themeColor(`label-${color}-ink`),
  });

  return board.columns.map((column) =>
    column.cards.map<CardLayout>((card) => {
      const chips = board.labels
        .filter((l) => card.labelIds.includes(l.id))
        .map((l) => ({ text: l.name, ...label(l.color) }));
      const meta: Chip[] = [];
      if (features.cardTypes && card.type !== 'task') {
        const m = CARD_TYPE_META[card.type];
        meta.push({ text: m.label, ...label(m.color) });
      }
      if (features.priority && card.priority) {
        const m = PRIORITY_META[card.priority];
        meta.push({ text: m.label, ...label(m.color) });
      }
      if (features.agile && card.storyPoints !== null) {
        meta.push({
          text: `${card.storyPoints} pts`,
          bg: themeColor('surface-3'),
          fg: themeColor('ink'),
        });
      }

      ctx.font = `600 14px ${FONT}`;
      const title = wrap(ctx, card.title, inner, 4);
      ctx.font = `400 12px ${FONT}`;
      const desc = card.description ? wrap(ctx, previewText(card.description), inner, 2) : [];

      const height =
        CARD_PAD * 2 +
        (chips.length ? CHIP_H + 8 : 0) +
        title.length * TITLE_LH +
        (desc.length ? 6 + desc.length * DESC_LH : 0) +
        (meta.length ? 10 + CHIP_H : 0);
      return { chips, title, desc, meta, height };
    }),
  );
}

function drawChips(ctx: Ctx, chips: Chip[], x: number, y: number) {
  ctx.font = `600 11px ${FONT}`;
  let cx = x;
  for (const chip of chips) {
    const w = ctx.measureText(chip.text).width + 12;
    ctx.fillStyle = chip.bg;
    ctx.beginPath();
    ctx.roundRect(cx, y, w, CHIP_H, 5);
    ctx.fill();
    ctx.fillStyle = chip.fg;
    ctx.fillText(chip.text, cx + 6, y + 13);
    cx += w + 4;
  }
}

/** Renders the whole board and returns it as a PNG blob. */
export async function renderBoardPng(board: Board): Promise<Blob> {
  // Text measured before the font loads would use the fallback metrics.
  await document.fonts?.load(`16px ${FONT}`);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');

  const cards = layoutCards(ctx, board);
  const HEADER = 64;
  const COL_HEADER = 36;
  const colHeights = cards.map(
    (col) =>
      COL_PAD * 2 +
      COL_HEADER +
      col.reduce((h, c) => h + c.height, 0) +
      Math.max(0, col.length - 1) * CARD_GAP,
  );
  const cols = Math.max(1, board.columns.length);
  const width = PAD * 2 + cols * COL_W + (cols - 1) * COL_GAP;
  const height = PAD * 2 + HEADER + Math.max(80, ...colHeights);

  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'alphabetic';

  // Background + title.
  ctx.fillStyle = themeColor('surface');
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = themeColor('ink');
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(board.name, PAD, PAD + 26);
  ctx.fillStyle = themeColor('muted');
  ctx.font = `400 12px ${FONT}`;
  const date = new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(new Date());
  ctx.fillText(`Devbord · ${date}`, PAD, PAD + 48);

  board.columns.forEach((column, i) => {
    const x = PAD + i * (COL_W + COL_GAP);
    let y = PAD + HEADER;

    ctx.fillStyle = themeColor('surface-2');
    ctx.beginPath();
    ctx.roundRect(x, y, COL_W, colHeights[i]!, 12);
    ctx.fill();

    ctx.fillStyle = themeColor('ink');
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(column.title, x + COL_PAD + 4, y + COL_PAD + 18);
    const count =
      column.wipLimit === null
        ? `${column.cards.length}`
        : `${column.cards.length}/${column.wipLimit}`;
    ctx.fillStyle = themeColor('muted');
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText(count, x + COL_W - COL_PAD - ctx.measureText(count).width - 4, y + COL_PAD + 18);

    y += COL_PAD + COL_HEADER;
    for (const card of cards[i]!) {
      const cx = x + COL_PAD;
      const cw = COL_W - COL_PAD * 2;
      ctx.fillStyle = themeColor('card');
      ctx.strokeStyle = themeColor('line-soft');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cx + 0.5, y + 0.5, cw - 1, card.height - 1, 8);
      ctx.fill();
      ctx.stroke();

      let ty = y + CARD_PAD;
      if (card.chips.length) {
        drawChips(ctx, card.chips, cx + CARD_PAD, ty);
        ty += CHIP_H + 8;
      }
      ctx.fillStyle = themeColor('ink');
      ctx.font = `600 14px ${FONT}`;
      for (const line of card.title) {
        ctx.fillText(line, cx + CARD_PAD, ty + 14);
        ty += TITLE_LH;
      }
      if (card.desc.length) {
        ty += 6;
        ctx.fillStyle = themeColor('muted');
        ctx.font = `400 12px ${FONT}`;
        for (const line of card.desc) {
          ctx.fillText(line, cx + CARD_PAD, ty + 12);
          ty += DESC_LH;
        }
      }
      if (card.meta.length) drawChips(ctx, card.meta, cx + CARD_PAD, ty + 10);

      y += card.height + CARD_GAP;
    }
  });

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG vacío'))), 'image/png'),
  );
}

/** Triggers a browser download for `blob`. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  // Revoke later: Safari cancels the download if the URL dies immediately.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
