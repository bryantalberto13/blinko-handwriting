/** @jsxImportSource preact */
import { useEffect, useRef, useState } from 'preact/hooks';
import { AUTO_INK, drawStroke, exportPng, pressureWidth, type Point, type Stroke } from './strokes';
import { transcribe } from './transcribe';

const COLORS = [AUTO_INK, '#2563eb', '#dc2626', '#16a34a'];
const WIDTHS = [{ label: 'Fine', w: 2 }, { label: 'Medium', w: 3.5 }, { label: 'Bold', w: 6 }];
const PAGE = 900; // px of writing space added per "page"

/** Unsaved ink survives closing the pad by accident; cleared after a successful insert. */
let draft: { strokes: Stroke[]; height: number } | null = null;

const pref = (k: string, d: string) => { try { return localStorage.getItem(`hw-${k}`) ?? d; } catch { return d; } };
const setPref = (k: string, v: string) => { try { localStorage.setItem(`hw-${k}`, v); } catch { /* private mode */ } };

const isDark = () => document.documentElement.classList.contains('dark');
const screenColor = (c: string) => (c === AUTO_INK ? (isDark() ? '#e5e5e5' : '#111111') : c);

export function HandwritingPad({ editor, onClose }: { editor: any; onClose: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>(draft?.strokes ?? []);
  const redoStack = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const activePointer = useRef<number | null>(null);
  const sawPen = useRef(false);

  const [height, setHeight] = useState(draft?.height ?? PAGE);
  const [color, setColor] = useState(pref('color', AUTO_INK));
  const [width, setWidth] = useState(Number(pref('width', '3.5')));
  const [erasing, setErasing] = useState(false);
  const [penOnly, setPenOnly] = useState(pref('penOnly', '1') === '1');
  const [attachImage, setAttachImage] = useState(pref('attach', '1') === '1');
  const [count, setCount] = useState(strokes.current.length); // re-render trigger for undo/redo state
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const saveDraft = () => { draft = strokes.current.length ? { strokes: strokes.current, height } : null; };

  /** Size the backing store for the device pixel ratio and repaint every stroke. */
  const redraw = () => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, height);
    for (const s of strokes.current) drawStroke(ctx, { ...s, color: screenColor(s.color) });
  };

  useEffect(() => {
    redraw();
    const ro = new ResizeObserver(redraw);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [height]);

  const toPoint = (e: PointerEvent): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    const p = e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5;
    return { x: e.clientX - r.left, y: e.clientY - r.top, p };
  };

  /** Draw only the newest smoothed segment while the pen moves (full redraw happens on lift). */
  const drawLive = (s: Stroke) => {
    const ctx = canvasRef.current!.getContext('2d')!;
    const pts = s.points, n = pts.length;
    if (n < 2) return drawStroke(ctx, { ...s, color: screenColor(s.color) });
    const a = pts[n - 2], b = pts[n - 1];
    const start = n === 2 ? pts[0] : { x: (pts[n - 3].x + a.x) / 2, y: (pts[n - 3].y + a.y) / 2 };
    const end = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    ctx.save();
    ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = screenColor(s.color);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = pressureWidth(s.width, a.p);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(a.x, a.y, end.x, end.y);
    ctx.stroke();
    ctx.restore();
  };

  /** With "pen only" on, fingers and palms scroll the page instead of drawing once a stylus has been seen. */
  const ignore = (e: PointerEvent) => e.pointerType === 'touch' && penOnly && sawPen.current;

  /** The canvas is touch-action:none so the browser never steals a stroke; ignored fingers scroll it by hand. */
  const panFrom = useRef<{ id: number; y: number } | null>(null);

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'pen') sawPen.current = true;
    if (ignore(e)) { panFrom.current = { id: e.pointerId, y: e.clientY }; return; }
    if (activePointer.current !== null || busy) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    activePointer.current = e.pointerId;
    // The stylus's eraser end erases too.
    const erase = erasing || e.button === 5 || (e.buttons & 32) !== 0;
    current.current = { points: [toPoint(e)], color, width: erase ? width * 6 : width, erase: erase || undefined };
    drawLive(current.current);
    setError('');
  };

  const onMove = (e: PointerEvent) => {
    if (panFrom.current?.id === e.pointerId) {
      scrollRef.current?.scrollBy(0, panFrom.current.y - e.clientY);
      panFrom.current.y = e.clientY;
      return;
    }
    if (e.pointerId !== activePointer.current || !current.current) return;
    e.preventDefault();
    const events = (e as any).getCoalescedEvents?.() ?? [e];
    for (const ev of events.length ? events : [e]) {
      current.current.points.push(toPoint(ev));
      drawLive(current.current);
    }
  };

  const onUp = (e: PointerEvent) => {
    if (panFrom.current?.id === e.pointerId) panFrom.current = null;
    if (e.pointerId !== activePointer.current) return;
    activePointer.current = null;
    const s = current.current;
    current.current = null;
    if (!s) return;
    strokes.current = [...strokes.current, s];
    redoStack.current = [];
    // Grow the page when writing near the bottom.
    if (s.points.some(p => p.y > height - 120)) setHeight(h => h + PAGE / 2);
    else redraw();
    setCount(strokes.current.length);
    saveDraft();
  };

  const undo = () => {
    const s = strokes.current.pop();
    if (s) redoStack.current.push(s);
    strokes.current = [...strokes.current];
    redraw(); setCount(strokes.current.length); saveDraft();
  };
  const redo = () => {
    const s = redoStack.current.pop();
    if (s) strokes.current = [...strokes.current, s];
    redraw(); setCount(strokes.current.length); saveDraft();
  };
  const clear = () => {
    if (!strokes.current.length || !confirm('Clear the whole page?')) return;
    strokes.current = [];
    redoStack.current = [];
    draft = null;
    setHeight(PAGE);
    redraw(); setCount(0);
  };

  const insert = async (withText: boolean) => {
    setError('');
    const png = await exportPng(strokes.current);
    if (!png) { setError('Write something first.'); return; }
    if (!editor) { setError('Could not find the note editor. Close this and tap the pen button again.'); return; }
    let text = '';
    try {
      if (withText) {
        setBusy('Transcribing your handwriting…');
        text = await transcribe(png);
        if (!text) throw new Error('The model returned no text. Is the writing legible, and does the model support images?');
      }
      if (text) editor.insertMarkdown(`${text}\n`);
      if (attachImage || !withText) {
        setBusy('Attaching the handwriting image…');
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        await editor.uploadFiles([new File([png], `handwriting-${stamp}.png`, { type: 'image/png' })]);
      }
      draft = null;
      strokes.current = [];
      window.Blinko.toast.success(withText ? 'Handwriting transcribed into the note' : 'Handwriting attached');
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy('');
    }
  };

  const tool = (on: boolean) => `hw-tool${on ? ' on' : ''}`;
  const hasInk = count > 0;

  return (
    <div class="hw-pad">
      <div class="hw-bar">
        <div class="hw-group">
          {COLORS.map(c => (
            <button key={c} class={tool(!erasing && color === c)} title={c === AUTO_INK ? 'Ink' : c}
              onClick={() => { setColor(c); setErasing(false); setPref('color', c); }}>
              <span class="hw-dot" style={{ background: screenColor(c) }} />
            </button>
          ))}
        </div>
        <div class="hw-group">
          {WIDTHS.map(o => (
            <button key={o.w} class={tool(!erasing && width === o.w)} title={o.label}
              onClick={() => { setWidth(o.w); setErasing(false); setPref('width', String(o.w)); }}>
              <span class="hw-line" style={{ height: `${o.w}px` }} />
            </button>
          ))}
          <button class={tool(erasing)} title="Eraser" onClick={() => setErasing(!erasing)}>Eraser</button>
        </div>
        <div class="hw-group">
          <button class="hw-tool" disabled={!hasInk} onClick={undo} title="Undo">↶</button>
          <button class="hw-tool" disabled={!redoStack.current.length} onClick={redo} title="Redo">↷</button>
          <button class="hw-tool" disabled={!hasInk} onClick={clear}>Clear</button>
          <button class="hw-tool" onClick={() => setHeight(h => h + PAGE)}>+ Page</button>
        </div>
        <label class="hw-check" title="Once a stylus is detected, fingers and palms scroll instead of drawing">
          <input type="checkbox" checked={penOnly} onChange={e => { const v = (e.target as HTMLInputElement).checked; setPenOnly(v); setPref('penOnly', v ? '1' : '0'); }} />
          Stylus only
        </label>
      </div>

      <div class="hw-scroll" ref={scrollRef}>
        <div class="hw-paper" ref={wrapRef} style={{ height: `${height}px` }}>
          <canvas ref={canvasRef} class={erasing ? 'erasing' : ''}
            onPointerDown={onDown as any} onPointerMove={onMove as any}
            onPointerUp={onUp as any} onPointerCancel={onUp as any} />
        </div>
      </div>

      <div class="hw-foot">
        <label class="hw-check">
          <input type="checkbox" checked={attachImage} onChange={e => { const v = (e.target as HTMLInputElement).checked; setAttachImage(v); setPref('attach', v ? '1' : '0'); }} />
          Also attach the handwriting image
        </label>
        <div class="hw-msg">
          {busy && <span class="hw-busy">{busy}</span>}
          {error && <span class="hw-err">{error}</span>}
        </div>
        <button class="hw-btn ghost" disabled={!!busy} onClick={onClose}>Close</button>
        {error && hasInk && <button class="hw-btn ghost" disabled={!!busy} onClick={() => insert(false)}>Attach image only</button>}
        <button class="hw-btn" disabled={!!busy || !hasInk} onClick={() => insert(true)}>
          {error ? 'Try again' : 'Transcribe & insert'}
        </button>
      </div>
    </div>
  );
}
