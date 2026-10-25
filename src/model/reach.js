/**
 * How far a model reaches past its base, and how closely such models can be packed.
 *
 * Overhang is given per side of the model: front (up in the top view, +y), right (+x),
 * back and left. The space a model takes up is its pocket with every point slid outward
 * by up to that much towards each side, with elliptical corners between two sides.
 * The same overhang on all four sides grows a round base into a larger circle; a gun on
 * one side stretches it into a stadium shape. The reach is always convex, which makes
 * the spacing between two models exact to compute from support functions.
 */
import { NOTCH_RADIUS, notchCentres, notchOutlines, pocketOutline } from './pockets';

export const SIDES = ['front', 'right', 'back', 'left'];
export const NO_OVERHANG = { front: 0, right: 0, back: 0, left: 0 };
export const MAX_OVERHANG = 100;

const clampSide = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(MAX_OVERHANG, Math.max(0, v)) : 0);

/** Overhang per side from stored data: a single number (saved before version 3) applies to every side. */
export function normalizeOverhang(value) {
  if (typeof value === 'number') return Object.fromEntries(SIDES.map((s) => [s, clampSide(value)]));
  if (value === null || typeof value !== 'object') return { ...NO_OVERHANG };
  return Object.fromEntries(SIDES.map((s) => [s, clampSide(value[s])]));
}

export const evenOverhang = (o) => SIDES.every((s) => o[s] === o.front);
export const largestOverhang = (o) => Math.max(...SIDES.map((s) => o[s]));
export const hasOverhang = (o) => largestOverhang(o) > 0;

/** The overhang of a model turned by 90° counter-clockwise, the way placeOutline turns pockets. */
export function turnOverhang(o) {
  return { front: o.right, left: o.front, back: o.left, right: o.back };
}

/**
 * Bounding box of the model's reach around its centre: { x0, x1, y0, y1 }. Finger
 * notches are cut into the floor, so they need room too where the model does not
 * already reach over them.
 */
export function reachBox(group, layout) {
  const o = normalizeOverhang(group.overhang);
  const rx = (group.sizeX + layout.baseClearance) / 2;
  const ry = (group.sizeY + layout.baseClearance) / 2;
  const box = { x0: -(rx + o.left), x1: rx + o.right, y0: -(ry + o.back), y1: ry + o.front };
  if (!group.notches) return box;
  for (const [x, y] of notchCentres(group, layout)) {
    box.x0 = Math.min(box.x0, x - NOTCH_RADIUS);
    box.x1 = Math.max(box.x1, x + NOTCH_RADIUS);
    box.y0 = Math.min(box.y0, y - NOTCH_RADIUS);
    box.y1 = Math.max(box.y1, y + NOTCH_RADIUS);
  }
  return box;
}

/** Points of the overhang shape, centred on the base: four quarter ellipses. */
function overhangPoints(o, perQuarter) {
  const points = [];
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const a = sx > 0 ? o.right : o.left;
    const b = sy > 0 ? o.front : o.back;
    for (let i = 0; i <= perQuarter; i++) {
      const phi = (Math.PI / 2) * (i / perQuarter);
      points.push([sx * a * Math.cos(phi), sy * b * Math.sin(phi)]);
    }
  }
  return points;
}

function convexHull(points) {
  const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 1e-12) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half(sorted.reverse())];
}

/** Outline of everything the model may reach, around its pocket, as counter-clockwise [x, y] points. */
export function reachOutline(group, layout, segments = 64) {
  const o = normalizeOverhang(group.overhang);
  const base = pocketOutline(group, layout, segments);
  const extra = overhangPoints(o, Math.max(2, Math.round(segments / 8)));
  const sums = [];
  for (const [bx, by] of base) for (const [ex, ey] of extra) sums.push([bx + ex, by + ey]);
  return convexHull([...sums, ...notchOutlines(group, layout, segments).flat()]);
}

/** Whether the model has finger notches, and which way they point when it is as wide as long. */
export const notchKey = (g) => (g.notches ? 1 + Boolean(g.notchTurned) : 0);

/** The model turned by `turns` quarter turns counter-clockwise, the way placeOutline turns pockets. */
export function turnGroup(group, turns) {
  let g = { ...group, overhang: normalizeOverhang(group.overhang) };
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) {
    g = { ...g, sizeX: g.sizeY, sizeY: g.sizeX, overhang: turnOverhang(g.overhang), notchTurned: !g.notchTurned };
  }
  return g;
}

/** Quarter turns that give the model a different footprint (a plain round base has just one). */
export function distinctTurns(group) {
  const seen = new Set();
  return [0, 1, 2, 3].filter((t) => {
    const g = turnGroup(group, t);
    const key = [g.sizeX, g.sizeY, notchKey(g), ...SIDES.map((s) => g.overhang[s])].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Directions the spacing between two models is checked along. Testing fewer directions
// than all of them can only ask for more room, never less.
export const STEPS = 360;
export const DIRS = Array.from({ length: STEPS }, (_, k) => {
  const a = (2 * Math.PI * k) / STEPS;
  return [Math.cos(a), Math.sin(a)];
});
/** Index of the direction opposite to direction k. */
export const opposite = (k) => (k + STEPS / 2) % STEPS;
// Dense enough that the pocket outlines of every preview resolution are inside this one.
const DENSE_SEGMENTS = 384;
// Bézier control factor that best matches a circle, 4/3·(√2 − 1).
const ELLIPSE_CURVATURE = (4 / 3) * (Math.SQRT2 - 1);

const shapeKey = (group, layout) => {
  const o = normalizeOverhang(group.overhang);
  return [group.shape, group.sizeX, group.sizeY, o.front, o.right, o.back, o.left, notchKey(group),
    layout.baseClearance, layout.spacing, layout.curvature].join('|');
};

const supportCache = new Map();

/**
 * Support functions of the pocket and of the reach, sampled in every direction of DIRS:
 * how far each reaches from the model's centre along that direction.
 */
export function shapeSupports(group, layout) {
  const key = shapeKey(group, layout);
  if (supportCache.has(key)) return supportCache.get(key);
  const o = normalizeOverhang(group.overhang);
  const round = group.shape === 'round' || group.shape === 'oval';
  // Up to this curvature the Bézier outline stays inside the true ellipse.
  const withinEllipse = round && layout.curvature <= ELLIPSE_CURVATURE;
  const rx = (group.sizeX + layout.baseClearance) / 2;
  const ry = (group.sizeY + layout.baseClearance) / 2;
  let dense = null;
  const outline = () => {
    dense ??= pocketOutline(group, layout, DENSE_SEGMENTS);
    return dense;
  };
  const notches = group.notches ? notchCentres(group, layout) : [];
  const pocket = new Float64Array(STEPS);
  const reach = new Float64Array(STEPS);
  DIRS.forEach(([ux, uy], k) => {
    // Round pockets are kept apart like true ellipses, which also covers their Bézier outline.
    let h = round ? Math.hypot(rx * ux, ry * uy) : -Infinity;
    if (!withinEllipse) for (const [px, py] of outline()) h = Math.max(h, ux * px + uy * py);
    const notch = notches.reduce((m, [cx, cy]) => Math.max(m, ux * cx + uy * cy + NOTCH_RADIUS), -Infinity);
    pocket[k] = Math.max(h, notch);
    reach[k] = Math.max(notch, h + Math.hypot((ux >= 0 ? o.right : o.left) * ux, (uy >= 0 ? o.front : o.back) * uy));
  });
  const result = { pocket, reach };
  if (supportCache.size > 2000) supportCache.clear();
  supportCache.set(key, result);
  return result;
}

/**
 * For every direction u, the room two copies of the model need along u: the reach's
 * width along u plus the spacing. Two copies at offset v are far enough apart when
 * u·v reaches that room for at least one u (separating axis).
 */
function roomAlong(group, layout) {
  const { reach } = shapeSupports(group, layout);
  return DIRS.map((_, k) => reach[k] + reach[opposite(k)] + layout.spacing);
}

function polygonArea(points) {
  let a = 0;
  points.forEach(([x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  });
  return Math.abs(a) / 2;
}

/** Smallest height t at which a copy offset by (x, t) is far enough away; 0 when x alone is enough. */
function rowClearance(room, x) {
  let best = Infinity;
  for (let k = 0; k < STEPS; k++) {
    const [ux, uy] = DIRS[k];
    if (Math.abs(uy) < 1e-12) {
      if (ux * x >= room[k] - 1e-9) return 0;
    } else if (uy > 0) {
      best = Math.min(best, (room[k] - ux * x) / uy);
    }
  }
  return Math.max(0, best);
}

/** Row step for rows `colStep` apart in a row, with each row shifted by `shift`. */
function rowStep(room, colStep, shift) {
  const reachX = room[0];
  const reachY = room[STEPS / 4];
  let step = 0;
  for (let j = 1; j <= 8; j++) {
    const from = Math.floor((-reachX - j * shift) / colStep);
    const to = Math.ceil((reachX - j * shift) / colStep);
    for (let i = from; i <= to; i++) step = Math.max(step, rowClearance(room, j * shift + i * colStep) / j);
    if ((j + 1) * step >= reachY) break;
  }
  return step;
}

const SHIFTS = 24;
const cache = new Map();

/**
 * Lattices a model can be packed in, in its current orientation: a straight grid and,
 * when it is tighter, rows shifted against each other so round ends nest. Each lattice
 * has the step within a row, the shift and step between rows, the reach box and the
 * area of the reach.
 */
export function lattices(group, layout) {
  const key = shapeKey(group, layout);
  if (cache.has(key)) return cache.get(key);

  const room = roomAlong(group, layout);
  let colStep = Infinity;
  DIRS.forEach(([ux], k) => { if (ux > 1e-12) colStep = Math.min(colStep, room[k] / ux); });
  const box = reachBox(group, layout);
  // Models never overlap, so each needs at least the area it reaches over.
  const area = polygonArea(reachOutline(group, layout, 64));
  const grid = { area, colStep, shift: 0, rowStep: rowStep(room, colStep, 0), box };
  let best = grid;
  for (let i = 1; i < SHIFTS; i++) {
    const shift = (colStep * i) / SHIFTS;
    const step = rowStep(room, colStep, shift);
    if (step < best.rowStep - 1e-9) best = { ...grid, shift, rowStep: step };
  }
  const result = best === grid ? [grid] : [best, grid];
  if (cache.size > 2000) cache.clear();
  cache.set(key, result);
  return result;
}
