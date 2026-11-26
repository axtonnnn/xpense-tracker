// Geometry helpers for the progress chart (kept pure so they can be unit-tested).

/** Clean y-axis ticks in cents (0, 250, 500… in major units), always reaching at least `maxCents`. */
export function niceTicks(maxCents: number, target = 3): number[] {
  const maxMajor = maxCents / 100;
  if (maxMajor <= 0) return [0];
  const raw = maxMajor / target;
  const pow = Math.max(1, 10 ** Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * pow).find((s) => s >= raw) ?? 10 * pow;
  const count = Math.max(1, Math.ceil(maxMajor / step - 1e-9));
  return Array.from({ length: count + 1 }, (_, i) => Math.round(i * step * 100));
}

/** SVG path for a bar whose top corners are rounded and whose baseline end is square. */
export function roundedTopBar(x: number, yTop: number, width: number, height: number, r = 4): string {
  if (height <= 0 || width <= 0) return '';
  const rr = Math.min(r, height, width / 2);
  const yBottom = yTop + height;
  return [
    `M${x},${yBottom}`,
    `L${x},${yTop + rr}`,
    `Q${x},${yTop} ${x + rr},${yTop}`,
    `L${x + width - rr},${yTop}`,
    `Q${x + width},${yTop} ${x + width},${yTop + rr}`,
    `L${x + width},${yBottom}`,
    'Z',
  ].join(' ');
}
