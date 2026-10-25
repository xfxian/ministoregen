/**
 * Free placement of a handful of mixed models, for cases the shelf packer leaves loose:
 * a few large models with overhangs and small ones that fit into the gaps between them.
 * Models go in one at a time, largest first, each turned whichever of four ways and
 * placed where it ends up lowest, then leftmost (bottom-left fill). Candidate spots
 * touch a model already placed or a wall, and the best ones slide down and left until
 * they rest against something. Reaches are convex, so whether two models keep their
 * distance follows from their support functions (see reach.js).
 */
import {
  DIRS, STEPS, distinctTurns, reachBox, shapeSupports, turnGroup,
} from './reach';

const EPS = 1e-6;
// Directions distances are checked along: every 4°. Fewer directions only ever find
// less room than there is, so models may end up a hair further apart, never closer.
const N = 90;
const COS = Float64Array.from({ length: N }, (_, k) => DIRS[(k * STEPS) / N][0]);
const SIN = Float64Array.from({ length: N }, (_, k) => DIRS[(k * STEPS) / N][1]);
// Directions around each placed model to try touching it from.
const CONTACT_STEP = 3;
// How many of the best spots get to slide into place.
const SLIDES = 6;
/** Most models placed freely; larger cases use the shelf packer only. */
export const NEST_LIMIT = 24;

function makeShape(group, layout, turns, id) {
  const g = turnGroup(group, turns);
  const { reach } = shapeSupports(g, layout);
  const h = Float64Array.from({ length: N }, (_, k) => reach[(k * STEPS) / N]);
  return { id, turns, h, box: reachBox(g, layout) };
}

/**
 * For each direction u, how far model b must be from model a along u to keep the gap:
 * b is far enough away at offset v when u·v reaches this for some u.
 */
function roomFor(cache, a, b, gap) {
  const key = a.id * 1000 + b.id;
  let room = cache.get(key);
  if (!room) {
    room = Float64Array.from({ length: N }, (_, k) => a.h[k] + b.h[(k + N / 2) % N] + gap - EPS);
    cache.set(key, room);
  }
  return room;
}

function apart(room, vx, vy) {
  // Start looking along v, where two near-round shapes are usually separated.
  const k0 = Math.round((Math.atan2(vy, vx) / (2 * Math.PI)) * N);
  for (let i = 0; i < N; i++) {
    const k = (((k0 + (i % 2 ? (i + 1) / 2 : -i / 2)) % N) + N) % N;
    if (COS[k] * vx + SIN[k] * vy >= room[k]) return true;
  }
  return false;
}

/**
 * Values of t for which model b at offset v0 + t·d from a is too close: the open
 * interval [lo, hi], or null when it never is.
 */
function overlapInterval(room, v0x, v0y, dx, dy) {
  let lo = -Infinity;
  let hi = Infinity;
  for (let k = 0; k < N; k++) {
    const left = room[k] - (COS[k] * v0x + SIN[k] * v0y);
    const along = COS[k] * dx + SIN[k] * dy;
    if (Math.abs(along) < 1e-12) {
      if (left <= 0) return null;
    } else if (along > 0) {
      hi = Math.min(hi, left / along);
    } else {
      lo = Math.max(lo, left / along);
    }
    if (lo >= hi) return null;
  }
  return [lo, hi];
}

function boxesApart(p, shape, x, y, gap) {
  const a = p.shape.box;
  const b = shape.box;
  return p.x + a.x1 + gap <= x + b.x0 + EPS || x + b.x1 + gap <= p.x + a.x0 + EPS
    || p.y + a.y1 + gap <= y + b.y0 + EPS || y + b.y1 + gap <= p.y + a.y0 + EPS;
}

function inside(shape, x, y, half) {
  const { box } = shape;
  return x + box.x0 >= -half.w - EPS && x + box.x1 <= half.w + EPS
    && y + box.y0 >= -half.l - EPS && y + box.y1 <= half.l + EPS;
}

/**
 * Bottom-left fill of `models` into an area of half sizes `half`, with `gap` between
 * models; `xFirst` fills along x first instead of y. Returns the placed models or null.
 */
function attempt(models, half, gap, xFirst) {
  const cache = new Map();
  const placed = [];
  const room = (p, shape) => roomFor(cache, p.shape, shape, gap);

  const fits = (shape, x, y) => inside(shape, x, y, half)
    && placed.every((p) => boxesApart(p, shape, x, y, gap) || apart(room(p, shape), x - p.x, y - p.y));

  // How far the model can move from (x, y) left or down before it touches anything.
  const travel = (shape, x, y, dx, dy) => {
    const { box } = shape;
    let t = dx < 0 ? x + box.x0 + half.w : y + box.y0 + half.l;
    for (const p of placed) {
      const hit = overlapInterval(room(p, shape), x - p.x, y - p.y, dx, dy);
      if (hit && hit[1] > EPS) t = Math.min(t, Math.max(0, hit[0]));
    }
    return Math.max(0, t);
  };

  // Spots that touch a placed model, or a wall and a placed model at once.
  const candidates = (shape) => {
    const { box } = shape;
    const left = -half.w - box.x0;
    const right = half.w - box.x1;
    const bottom = -half.l - box.y0;
    const top = half.l - box.y1;
    const spots = [[left, bottom], [right, bottom], [left, top]];
    for (const p of placed) {
      const r = room(p, shape);
      for (let k = 0; k < N; k += CONTACT_STEP) {
        const hit = overlapInterval(r, 0, 0, COS[k], SIN[k]);
        if (hit) spots.push([p.x + hit[1] * COS[k], p.y + hit[1] * SIN[k]]);
      }
      for (const [x0, y0, dx, dy] of [[left, p.y, 0, 1], [right, p.y, 0, 1], [p.x, bottom, 1, 0], [p.x, top, 1, 0]]) {
        const hit = overlapInterval(r, x0 - p.x, y0 - p.y, dx, dy);
        if (hit) spots.push([x0 + hit[0] * dx, y0 + hit[0] * dy], [x0 + hit[1] * dx, y0 + hit[1] * dy]);
      }
    }
    return spots;
  };

  // Lower is better: the top edge first, then the right edge (or the other way round).
  const score = (shape, x, y) => {
    const topEdge = y + shape.box.y1;
    const rightEdge = x + shape.box.x1;
    return xFirst ? rightEdge * 1e4 + topEdge : topEdge * 1e4 + rightEdge;
  };

  const settle = (shape, x, y) => {
    let px = x;
    let py = y;
    const moves = xFirst ? [[-1, 0], [0, -1]] : [[0, -1], [-1, 0]];
    for (let i = 0; i < 8; i++) {
      let moved = 0;
      for (const [dx, dy] of moves) {
        const t = travel(shape, px, py, dx, dy);
        px += t * dx;
        py += t * dy;
        moved += t;
      }
      if (moved < 0.01) break;
    }
    return [px, py];
  };

  for (const m of models) {
    const options = [];
    for (const shape of m.shapes) {
      for (const [x, y] of candidates(shape)) {
        if (inside(shape, x, y, half)) options.push({ shape, x, y, score: score(shape, x, y) });
      }
    }
    // Only the best few spots that are free get to settle; sliding only ever improves them.
    options.sort((a, b) => a.score - b.score);
    let best = null;
    let tried = 0;
    for (const o of options) {
      if (tried >= SLIDES) break;
      if (!fits(o.shape, o.x, o.y)) continue;
      tried++;
      const [x, y] = settle(o.shape, o.x, o.y);
      const s = score(o.shape, x, y);
      if (!best || s < best.score) best = { shape: o.shape, x, y, score: s };
    }
    if (!best) return null;
    placed.push({ gi: m.gi, shape: best.shape, x: best.x, y: best.y });
  }
  return placed;
}

function nest(groups, layout, width, length) {
  const models = [];
  let id = 0;
  groups.forEach((group, gi) => {
    const shapes = distinctTurns(group).map((t) => makeShape(group, layout, t, id++));
    const { box } = shapes[0];
    const area = (box.x1 - box.x0) * (box.y1 - box.y0);
    for (let i = 0; i < group.count; i++) models.push({ gi, shapes, area });
  });
  if (!models.length || models.length > NEST_LIMIT) return null;
  models.sort((a, b) => b.area - a.area || a.gi - b.gi);
  const half = { w: width / 2, l: length / 2 };
  const placed = attempt(models, half, layout.spacing, false) ?? attempt(models, half, layout.spacing, true);
  if (!placed) return null;

  // Centre what the models reach in the area.
  const x0 = Math.min(...placed.map((p) => p.x + p.shape.box.x0));
  const x1 = Math.max(...placed.map((p) => p.x + p.shape.box.x1));
  const y0 = Math.min(...placed.map((p) => p.y + p.shape.box.y0));
  const y1 = Math.max(...placed.map((p) => p.y + p.shape.box.y1));
  const positions = groups.map(() => []);
  for (const p of placed) positions[p.gi].push([p.x - (x0 + x1) / 2, p.y - (y0 + y1) / 2, p.shape.turns]);
  return positions;
}

const memo = new Map();

/**
 * Places every miniature of `groups` in a `width` × `length` area. Returns pocket
 * positions per group ([x, y, quarter turns]), or null when they do not all fit.
 * An area and the same area turned by 90° share one result, turned to match.
 */
export function nestGroups(groups, layout, width, length) {
  const wide = width > length;
  const key = JSON.stringify([groups.map((g) => [g.shape, g.sizeX, g.sizeY, g.overhang, Boolean(g.notches), g.count]),
    layout.baseClearance, layout.spacing, layout.curvature, Math.min(width, length), Math.max(width, length)]);
  if (!memo.has(key)) {
    if (memo.size > 500) memo.clear();
    memo.set(key, nest(groups, layout, Math.min(width, length), Math.max(width, length)));
  }
  const result = memo.get(key);
  // Results are kept for the upright area; turn them a quarter for a wide one.
  return result && wide ? result.map((list) => list.map(([x, y, t]) => [-y, x, t + 1])) : result;
}
