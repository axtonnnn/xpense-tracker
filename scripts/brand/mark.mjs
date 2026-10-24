// Xpense brand mark: an X made of four slim leaves. The "/" diagonal is needs, the "\" diagonal is
// wants — the app's whole idea in one symbol. Geometry is on a 1024 × 1024 canvas centred at (512, 512).
// The same numbers drive the in-app <LogoMark /> (src/components/brand.tsx); keep them in sync.

export const GEOMETRY = { r0: 14, R: 400, w: 86, rib: 14 };

export const COLORS = {
  light: { need: '#0E8066', want: '#CC8418', rib: '#F6F4EE', word: '#1E5B4F' },
  dark: { need: '#8FD3B6', want: '#F0BE5C', rib: '#123F36', word: '#E9EFEC' },
  icon: { need: '#8FD3B6', want: '#F0BE5C', rib: '#1A5747', top: '#23715F', bottom: '#123F36' },
};

/** One leaf pointing along +x: base at r0 (near the centre), tip at R, widest just past the middle. */
export function leafPath({ r0, R, w } = GEOMETRY) {
  const len = R - r0;
  return `M ${r0} 0 C ${r0 + len * 0.18} ${-w * 0.95} ${r0 + len * 0.62} ${-w * 1.02} ${R} 0 C ${r0 + len * 0.62} ${w * 1.02} ${r0 + len * 0.18} ${w * 0.95} ${r0} 0 Z`;
}

// SVG y grows downwards: -45° points top-right and 135° bottom-left (the "/" diagonal, needs);
// -135° points top-left and 45° bottom-right (the "\" diagonal, wants).
export const NEED_ANGLES = [-45, 135];
export const WANT_ANGLES = [-135, 45];

function leaf(angle, fill, rib, { ribs = true, g = GEOMETRY, cx = 512, cy = 512, scale = 1 } = {}) {
  const start = g.r0 + (g.R - g.r0) * 0.16;
  const end = g.R - (g.R - g.r0) * 0.2;
  const ribPath = ribs
    ? `<path d="M ${start.toFixed(1)} 0 L ${end.toFixed(1)} 0" stroke="${rib}" stroke-width="${g.rib}" stroke-linecap="round"/>`
    : '';
  return `<g transform="translate(${cx} ${cy}) scale(${scale}) rotate(${angle})"><path d="${leafPath(g)}" fill="${fill}"/>${ribPath}</g>`;
}

/** The mark's leaves; pick which diagonals to draw (used for the Icon Composer layers). */
export function leaves(colors, { which = 'both', ribs = true, scale = 1 } = {}) {
  const parts = [];
  if (which !== 'wants') NEED_ANGLES.forEach((a) => parts.push(leaf(a, colors.need, colors.rib, { ribs, scale })));
  if (which !== 'needs') WANT_ANGLES.forEach((a) => parts.push(leaf(a, colors.want, colors.rib, { ribs, scale })));
  return parts.join('');
}

/** A silhouette for single-colour uses (Android themed icon): white leaves with the ribs cut out. */
export function silhouette({ scale = 1 } = {}) {
  const all = [...NEED_ANGLES, ...WANT_ANGLES];
  // In the mask, white leaves keep the shape and black ribs punch through it.
  return `<defs><mask id="ribs" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
    <rect width="1024" height="1024" fill="black"/>${all.map((a) => leaf(a, 'white', 'black', { scale })).join('')}</mask></defs>
    <rect width="1024" height="1024" fill="white" mask="url(#ribs)"/>`;
}

export function iconBackground(id = 'bg') {
  const { top, bottom } = COLORS.icon;
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#${id})"/>`;
}

export const svg = (body, size = 1024, viewBox = '0 0 1024 1024') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">${body}</svg>`;
