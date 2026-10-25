// Hand-drawn ink, shared by the app (src/components/sketch.tsx, illustrations.tsx) and the website
// (worker/src/pages.ts). A seeded "pen" draws lines that overshoot their corners and bow a little, so a
// frame looks drawn once by hand yet stays exactly the same every time it is drawn.

export type Pen = ReturnType<typeof pen>;

export function pen(seed: number) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (a: number, b: number) => a + (b - a) * rand();
  const f = (n: number) => Math.round(n * 100) / 100;

  /** A straight-ish stroke: starts and ends a little past its points and bows sideways. */
  const seg = (x1: number, y1: number, x2: number, y2: number, over = 1.5, bow = 1) => {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / L;
    const uy = (y2 - y1) / L;
    const a = between(0, over);
    const b = between(0, over);
    const sx = x1 - ux * a;
    const sy = y1 - uy * a;
    const ex = x2 + ux * b;
    const ey = y2 + uy * b;
    const k = between(-bow, bow);
    const t = between(0.35, 0.65);
    return `M${f(sx)} ${f(sy)}Q${f(sx + (ex - sx) * t - uy * k)} ${f(sy + (ey - sy) * t + ux * k)} ${f(ex)} ${f(ey)}`;
  };

  const rect = (x: number, y: number, w: number, h: number, over = 1, bow = 0.6) =>
    seg(x, y, x + w, y, over, bow) + seg(x + w, y, x + w, y + h, over, bow) + seg(x + w, y + h, x, y + h, over, bow) + seg(x, y + h, x, y, over, bow);

  /** A loop drawn in one go: it wobbles slightly and runs past where it started. */
  const circle = (cx: number, cy: number, r: number, turn = 1.1) => {
    const n = 12;
    const a0 = between(0, Math.PI * 2);
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 * turn;
      const rr = r * (1 + between(-0.05, 0.05));
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f((pts[i][0] + pts[i + 1][0]) / 2)} ${f((pts[i][1] + pts[i + 1][1]) / 2)}`;
    }
    return d;
  };

  /** A zigzag torn edge from x2 back to x1, like the bottom of a receipt. */
  const zig = (x1: number, x2: number, y: number, step: number, amp: number) => {
    let d = `M${f(x2)} ${f(y)}`;
    let up = true;
    for (let x = x2 - step / 2; x > x1; x -= step / 2) {
      d += `L${f(x + between(-0.5, 0.5))} ${f(y + (up ? amp : 0) + between(-0.4, 0.4))}`;
      up = !up;
    }
    return `${d}L${f(x1)} ${f(y)}`;
  };

  return { seg, rect, circle, zig, f };
}

/** A stable seed from any string (FNV-1a), so a component keeps its own wobble across renders. */
export function seedOf(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A sketched frame on a 100 × 100 box (stretched over a card), plus a fainter second pass. */
export function framePaths(seed: number): [string, string] {
  const box = (p: Pen) => p.rect(1, 1, 98, 98, 0.9, 0.7);
  return [box(pen(seed)), box(pen(seed + 101))];
}

/** A curved pencil arrow with a two-stroke head. */
export function arrow(P: Pen, x1: number, y1: number, x2: number, y2: number, bend: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  const cx = (x1 + x2) / 2 - (dy / L) * bend;
  const cy = (y1 + y2) / 2 + (dx / L) * bend;
  const tl = Math.hypot(x2 - cx, y2 - cy);
  const ux = (x2 - cx) / tl;
  const uy = (y2 - cy) / tl;
  const head = (rot: number) => {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return P.seg(x2, y2, x2 - (ux * c - uy * s) * 8, y2 - (ux * s + uy * c) * 8, 0.4, 0.3);
  };
  return `M${P.f(x1)} ${P.f(y1)}Q${P.f(cx)} ${P.f(cy)} ${P.f(x2)} ${P.f(y2)}${head(0.45)}${head(-0.45)}`;
}

/** A receipt from Green Valley Market (on a 326 × 222 canvas): outline, need/want squares, item lines. */
export function receiptDrawing() {
  const p = pen(7);
  const q = pen(8);
  const edge = (P: Pen) => P.seg(72, 12, 204, 11, 2, 1) + P.seg(204, 11, 205, 190, 2, 1.4) + P.seg(71, 190, 72, 12, 2, 1.4) + P.zig(71, 205, 190, 9, 7);
  const kinds = ['need', 'need', 'need', 'want', 'want', 'need'];
  const lens = [62, 48, 66, 54, 70, 58];
  let needs = '';
  let wants = '';
  let rows = '';
  kinds.forEach((k, i) => {
    const y = 48 + i * 18;
    const sq = `M80 ${y - 4}h8v8h-8z`;
    if (k === 'need') needs += sq;
    else wants += sq;
    rows += p.seg(96, y, 96 + lens[i], y, 1, 0.6) + p.seg(172, y, 194, y, 0.8, 0.4);
  });
  const notes = pen(31);
  return {
    fill: 'M72 12L204 11L205 190L71 190Z',
    edge: edge(p),
    edge2: edge(q),
    needs,
    wants,
    rows,
    dash: p.seg(80, 162, 196, 162, 0.5, 0.3),
    arrows: arrow(notes, 224, 22, 198, 46, -10) + arrow(notes, 226, 88, 200, 112, 12),
  };
}

/** A pencil lying at `angleDeg`, its graphite tip at `tip`. */
export function pencilDrawing(tip: [number, number], angleDeg: number, length = 160) {
  const p = pen(19);
  const q = pen(20);
  const a = (angleDeg * Math.PI) / 180;
  const u = [Math.cos(a), Math.sin(a)];
  const n = [-u[1], u[0]];
  const w = 6.5;
  const at = (d: number, o: number): [number, number] => [tip[0] + u[0] * d + n[0] * o, tip[1] + u[1] * d + n[1] * o];
  const L = (P: Pen, A: [number, number], B: [number, number], ov = 1.2, bw = 0.6) => P.seg(A[0], A[1], B[0], B[1], ov, bw);
  const end = length;
  const lines = (P: Pen) =>
    L(P, at(0, 0), at(22, w)) +
    L(P, at(0, 0), at(22, -w)) +
    L(P, at(22, w), at(end, w), 2, 1.2) +
    L(P, at(22, -w), at(end, -w), 2, 1.2) +
    L(P, at(22, -w), at(22, w), 0.5, 0.4) +
    L(P, at(end - 28, -w), at(end - 28, w), 0.5, 0.3) +
    L(P, at(end - 20, -w), at(end - 20, w), 0.5, 0.3) +
    L(P, at(end, -w), at(end, w), 0.6, 0.5) +
    L(P, at(22, 0), at(end - 28, 0), 1, 0.6);
  const poly = (pts: [number, number][]) => `M${pts.map((pt) => pt.map((v) => p.f(v)).join(' ')).join('L')}Z`;
  return {
    body: poly([at(0, 0), at(22, w), at(end, w), at(end, -w), at(22, -w)]),
    lines: lines(p),
    lines2: lines(q),
    lead: poly([at(0, 0), at(7, 2.2), at(7, -2.2)]),
  };
}

/** Corner brackets around a blank receipt (on a 326 × 214 canvas): "put it here". */
export function viewfinderDrawing() {
  const p = pen(17);
  const q = pen(18);
  const i = 18;
  const W = 326;
  const H = 214;
  const L = 30;
  const corners =
    p.seg(i, i + L, i, i, 0.5, 0.4) + p.seg(i, i, i + L, i, 0.5, 0.4) +
    p.seg(W - i - L, i, W - i, i, 0.5, 0.4) + p.seg(W - i, i, W - i, i + L, 0.5, 0.4) +
    p.seg(W - i, H - i - L, W - i, H - i, 0.5, 0.4) + p.seg(W - i, H - i, W - i - L, H - i, 0.5, 0.4) +
    p.seg(i + L, H - i, i, H - i, 0.5, 0.4) + p.seg(i, H - i, i, H - i - L, 0.5, 0.4);
  const X1 = 120;
  const X2 = 206;
  const Y1 = 30;
  const Y2 = 172;
  const edge = (P: Pen) =>
    P.seg(X1, Y1, X2, Y1 - 1, 1.6, 0.8) + P.seg(X2, Y1 - 1, X2 + 1, Y2, 1.6, 1.2) + P.seg(X1 - 1, Y2, X1, Y1, 1.6, 1.2) + P.zig(X1 - 1, X2 + 1, Y2, 8, 6);
  let rows = p.seg(140, 44, 186, 44, 0.6, 0.3);
  [40, 30, 46, 34, 42, 28].forEach((len, k) => {
    const y = 62 + k * 14;
    rows += p.seg(130, y, 130 + len, y, 0.8, 0.5) + p.seg(182, y, 196, y, 0.6, 0.3);
  });
  rows += p.seg(130, 152, 196, 152, 0.6, 0.4) + p.seg(170, 160, 196, 160, 0.6, 0.3);
  return { corners, fill: `M${X1} ${Y1}L${X2} ${Y1 - 1}L${X2 + 1} ${Y2}L${X1 - 1} ${Y2}Z`, edge: edge(p), edge2: edge(q), rows };
}

/** A blank page with a pencil (on a 220 × 190 canvas): "nothing written down yet". */
export function blankPageDrawing() {
  const p = pen(41);
  const q = pen(42);
  const page = (P: Pen) => P.rect(40, 14, 120, 150, 2, 1.4);
  let lines = '';
  [46, 64, 82, 100, 118].forEach((y, k) => (lines += p.seg(58, y, 142 - (k % 2) * 18, y, 0.8, 0.6)));
  return { page: page(p), page2: page(q), lines, pencil: pencilDrawing([132, 168], -38, 120) };
}
