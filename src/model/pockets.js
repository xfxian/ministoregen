// Finger notches: a circle this big, centred this far inside the pocket edge.
export const NOTCH_RADIUS = 8;
const NOTCH_INSET = 2;
/** How far a finger notch reaches past the pocket. */
export const NOTCH_REACH = NOTCH_RADIUS - NOTCH_INSET;

/** Smallest touchpoint size, and the touchpoint size a new layout starts with. */
export const MIN_PAD = 2;
const NEW_PAD = 10;

/** Ways a model without a base can touch the ground, for the "No base" shape. */
export const PAD_LAYOUTS = ['tracks', 'three', 'four'];

/**
 * Touchpoints for a footprint of `sizeX` × `sizeY` mm, front up (+y), as
 * { x, y, sizeX, sizeY, shape } centred on the footprint:
 * - tracks: two rails along the length, one per side;
 * - three: a nose leg in front and two legs at the back;
 * - four: a leg near each corner.
 */
export function padLayout(kind, sizeX, sizeY) {
  const pad = Math.max(MIN_PAD, Math.min(NEW_PAD, sizeX / 3, sizeY / 3));
  const ex = (sizeX - pad) / 2;
  const ey = (sizeY - pad) / 2;
  const leg = (x, y) => ({ x, y, sizeX: pad, sizeY: pad, shape: 'round' });
  if (kind === 'tracks') {
    const width = Math.max(MIN_PAD, Math.min(15, sizeX / 4));
    const rail = (x) => ({ x, y: 0, sizeX: width, sizeY: sizeY * 0.9, shape: 'rect' });
    return [rail(-(sizeX - width) / 2), rail((sizeX - width) / 2)];
  }
  if (kind === 'three') return [leg(0, ey * 0.8), leg(-ex * 0.8, -ey * 0.8), leg(ex * 0.8, -ey * 0.8)];
  return [leg(-ex * 0.8, ey * 0.8), leg(ex * 0.8, ey * 0.8), leg(-ex * 0.8, -ey * 0.8), leg(ex * 0.8, -ey * 0.8)];
}

/** Keeps a touchpoint inside the footprint of its model. */
export function clampPad(pad, sizeX, sizeY) {
  const w = Math.min(sizeX, Math.max(MIN_PAD, pad.sizeX));
  const l = Math.min(sizeY, Math.max(MIN_PAD, pad.sizeY));
  const inside = (v, room) => Math.min(room, Math.max(-room, v));
  return {
    x: inside(pad.x, (sizeX - w) / 2),
    y: inside(pad.y, (sizeY - l) / 2),
    sizeX: w,
    sizeY: l,
    shape: pad.shape === 'rect' ? 'rect' : 'round',
  };
}

/**
 * Centres of the two finger notches: on the long sides of the pocket, where fingers
 * reach under a model to lift it out (left and right on a round or square base).
 * The planner turns a model by swapping its sizes; `notchTurned` keeps track of a
 * turned base that is as wide as long, whose notches then sit front and back.
 */
export function notchCentres(group, layout) {
  const rx = (group.sizeX + layout.baseClearance) / 2;
  const ry = (group.sizeY + layout.baseClearance) / 2;
  return group.sizeX < group.sizeY || (group.sizeX === group.sizeY && !group.notchTurned)
    ? [[rx - NOTCH_INSET, 0], [-(rx - NOTCH_INSET), 0]]
    : [[0, ry - NOTCH_INSET], [0, -(ry - NOTCH_INSET)]];
}

function circleOutline(cx, cy, r, segments) {
  return Array.from({ length: segments }, (_, i) => {
    const a = (2 * Math.PI * i) / segments;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

/** Outlines of the finger notches of a model, none when it has none. */
export function notchOutlines(group, layout, segments = 64) {
  if (!group.notches) return [];
  return notchCentres(group, layout).map(([x, y]) => circleOutline(x, y, NOTCH_RADIUS, Math.max(12, Math.round(segments / 2))));
}

/**
 * Everything cut for one model, centred on the origin: its pocket, or for a model
 * without a base one pocket per touchpoint, plus finger notches. Each outline is
 * counter-clockwise; they may overlap, so callers union them.
 */
export function cutOutlines(group, layout, segments = 64) {
  const pockets = group.shape === 'pads'
    ? (group.pads ?? []).map((p) => placeOutline(pocketOutline(p, layout, segments), [p.x, p.y, 0]))
    : [pocketOutline(group, layout, segments)];
  return [...pockets, ...notchOutlines(group, layout, segments)];
}

/**
 * 2D outline of one pocket, centred on the origin, as [x, y] points in
 * counter-clockwise order. Shared by the inlay and the floor pockets. For a model
 * without a base, this is the footprint it stands over (see cutOutlines).
 */
export function pocketOutline(group, layout, segments = 64) {
  const rx = (group.sizeX + layout.baseClearance) / 2;
  const ry = (group.sizeY + layout.baseClearance) / 2;
  if (group.shape === 'square' || group.shape === 'rect' || group.shape === 'pads') {
    return roundedRectOutline(rx, ry, Math.min(1, rx, ry), Math.max(2, Math.round(segments / 8)));
  }
  return bezierEllipseOutline(rx, ry, layout.curvature, Math.max(4, Math.round(segments / 4)));
}

/**
 * Outline points moved to a pocket position [x, y, turns], turned by that many quarter
 * turns counter-clockwise (`true`, from older plans, counts as one).
 */
export function placeOutline(outline, [x, y, turns]) {
  const q = (((Number(turns) || 0) % 4) + 4) % 4;
  const turn = [
    ([px, py]) => [x + px, y + py],
    ([px, py]) => [x - py, y + px],
    ([px, py]) => [x - px, y - py],
    ([px, py]) => [x + py, y - px],
  ][q];
  return outline.map(turn);
}

// Four cubic Bézier quarters; a curvature of 0.55 approximates a true ellipse,
// lower values give flatter sides for oval bases that are not quite elliptical.
function bezierEllipseOutline(rx, ry, k, perQuarter) {
  const cx = rx * k;
  const cy = ry * k;
  const quarters = [
    [[rx, 0], [rx, cy], [cx, ry], [0, ry]],
    [[0, ry], [-cx, ry], [-rx, cy], [-rx, 0]],
    [[-rx, 0], [-rx, -cy], [-cx, -ry], [0, -ry]],
    [[0, -ry], [cx, -ry], [rx, -cy], [rx, 0]],
  ];
  const points = [];
  for (const [p0, p1, p2, p3] of quarters) {
    for (let i = 0; i < perQuarter; i++) {
      const t = i / perQuarter;
      const u = 1 - t;
      const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      points.push([
        a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
        a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
      ]);
    }
  }
  return points;
}

function roundedRectOutline(rx, ry, r, perCorner) {
  const corners = [[rx - r, ry - r, 0], [-(rx - r), ry - r, 90], [-(rx - r), -(ry - r), 180], [rx - r, -(ry - r), 270]];
  const points = [];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= perCorner; i++) {
      const a = ((start + (90 * i) / perCorner) * Math.PI) / 180;
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return points;
}
