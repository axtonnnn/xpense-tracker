// Xpense brand mark: an X made of four slim leaves, drawn in ink. The "/" diagonal is needs (solid ink),
// the "\" diagonal is wants (hatched) — the app's whole idea in one symbol. Geometry is on a
// 1024 × 1024 canvas centred at (512, 512). The same numbers drive the in-app <LogoMark />
// (src/components/brand.tsx) and the website (worker/src/pages.ts); keep them in sync.

export const GEOMETRY = { r0: 14, R: 400, w: 86 };

export const COLORS = { ink: '#111111', paper: '#F4F3EF', page: '#FFFFFF' };

/** One leaf pointing along +x: base at r0 (near the centre), tip at R, widest just past the middle. */
export function leafPath({ r0, R, w } = GEOMETRY) {
  const len = R - r0;
  return `M ${r0} 0 C ${r0 + len * 0.18} ${-w * 0.95} ${r0 + len * 0.62} ${-w * 1.02} ${R} 0 C ${r0 + len * 0.62} ${w * 1.02} ${r0 + len * 0.18} ${w * 0.95} ${r0} 0 Z`;
}

// SVG y grows downwards: -45° points top-right and 135° bottom-left (the "/" diagonal, needs);
// -135° points top-left and 45° bottom-right (the "\" diagonal, wants).
export const NEED_ANGLES = [-45, 135];
export const WANT_ANGLES = [-135, 45];

const leaf = (angle, attrs, { cx = 512, cy = 512, scale = 1 } = {}) =>
  `<g transform="translate(${cx} ${cy}) scale(${scale}) rotate(${angle})"><path d="${leafPath()}" ${attrs}/></g>`;

/**
 * The mark's leaves. `which` picks the diagonals (the Icon Composer bundle has them as layers);
 * `hatch` is the spacing of the wants' lines in canvas units, or 0 for plain outlines (tiny sizes), and
 * `outline` the width of the wants' edge, in canvas units after scaling.
 */
export function leaves({ which = 'both', scale = 1, hatch = 36, ink = COLORS.ink, fill = COLORS.paper, id = 'hatch', outline: edge = 16 } = {}) {
  const parts = [];
  const outline = Math.round(edge / Math.max(scale, 0.5));
  if (hatch && which !== 'needs') {
    parts.push(
      `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${hatch}" height="${hatch}" patternTransform="rotate(45)"><line x1="${hatch / 2}" y1="0" x2="${hatch / 2}" y2="${hatch}" stroke="${ink}" stroke-width="${hatch / 4}"/></pattern></defs>`,
    );
  }
  if (which !== 'wants') NEED_ANGLES.forEach((a) => parts.push(leaf(a, `fill="${ink}"`, { scale })));
  if (which !== 'needs')
    WANT_ANGLES.forEach((a) => parts.push(leaf(a, `fill="${hatch ? `url(#${id})` : fill}" stroke="${ink}" stroke-width="${outline}"`, { scale })));
  return parts.join('');
}

/** A single-colour silhouette (Android themed icon): white needs leaves, outlined wants leaves. */
export function silhouette({ scale = 1 } = {}) {
  return leaves({ scale, hatch: 0, ink: 'white', fill: 'transparent' });
}

export const paperBackground = () => `<rect width="1024" height="1024" fill="${COLORS.paper}"/>`;

export const svg = (body, size = 1024, viewBox = '0 0 1024 1024') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">${body}</svg>`;
