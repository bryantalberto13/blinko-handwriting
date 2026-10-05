/** Vector ink model: strokes are kept as points so the page can be redrawn, undone and exported crisply. */

export interface Point {
  x: number;
  y: number;
  /** Pen pressure 0..1 (mouse/finger report 0.5). */
  p: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  /** Base width in CSS px at pressure 0.5. */
  width: number;
  /** Eraser strokes clear ink underneath instead of drawing. */
  erase?: boolean;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Width of a segment for a given pressure: light touches stay thin, firm ones up to 1.6x. */
export const pressureWidth = (base: number, p: number) => base * (0.4 + 1.2 * Math.min(1, Math.max(0, p)));

/** Bounding box of all ink (eraser strokes ignored), padded, or null if the page is empty. */
export function inkBounds(strokes: Stroke[], pad = 24): Box | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    if (s.erase) continue;
    const r = pressureWidth(s.width, 1) / 2;
    for (const pt of s.points) {
      minX = Math.min(minX, pt.x - r);
      minY = Math.min(minY, pt.y - r);
      maxX = Math.max(maxX, pt.x + r);
      maxY = Math.max(maxY, pt.y + r);
    }
  }
  if (minX === Infinity) return null;
  const x = Math.max(0, Math.floor(minX - pad));
  const y = Math.max(0, Math.floor(minY - pad));
  return { x, y, w: Math.ceil(maxX + pad) - x, h: Math.ceil(maxY + pad) - y };
}

/** Draw one stroke. Variable width is drawn segment by segment, smoothed through midpoints. */
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  const pts = s.points;
  if (!pts.length) return;
  ctx.save();
  ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, pressureWidth(s.width, pts[0].p) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  let prevMid = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, p: (a.p + b.p) / 2 };
    const end = i === pts.length - 1 ? b : mid;
    ctx.beginPath();
    ctx.lineWidth = pressureWidth(s.width, a.p);
    ctx.moveTo(prevMid.x, prevMid.y);
    ctx.quadraticCurveTo(a.x, a.y, end.x, end.y);
    ctx.stroke();
    prevMid = end;
  }
  ctx.restore();
}

/**
 * Render the ink, cropped to its bounds, on white (vision models read dark-on-white best;
 * the page may be shown in dark mode). Returns a PNG blob, or null if nothing was written.
 */
export async function exportPng(strokes: Stroke[], maxEdge = 2000): Promise<Blob | null> {
  const box = inkBounds(strokes);
  if (!box) return null;
  const scale = Math.min(2, maxEdge / Math.max(box.w, box.h));
  // Ink and eraser are composited on a transparent layer first so erasing never punches through the white.
  const ink = document.createElement('canvas');
  ink.width = Math.max(1, Math.round(box.w * scale));
  ink.height = Math.max(1, Math.round(box.h * scale));
  const ictx = ink.getContext('2d')!;
  ictx.scale(scale, scale);
  ictx.translate(-box.x, -box.y);
  for (const s of strokes) drawStroke(ictx, { ...s, color: exportColor(s.color) });
  const out = document.createElement('canvas');
  out.width = ink.width;
  out.height = ink.height;
  const octx = out.getContext('2d')!;
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(ink, 0, 0);
  return new Promise(resolve => out.toBlob(b => resolve(b), 'image/png'));
}

/** The "auto" ink colour follows the theme on screen but is always black in the exported image. */
export const AUTO_INK = 'auto';
export const exportColor = (c: string) => (c === AUTO_INK ? '#111111' : c);
