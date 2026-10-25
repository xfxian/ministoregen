/**
 * Gridfinity bin shell built with manifold-3d.
 *
 * The shell owns everything that must stay compatible with Gridfinity:
 * the 42 mm grid, the foot profile, the stacking lip, 7 mm height units and
 * the 3.75 mm outer corner radius. Dimensions follow the Gridfinity
 * specification (https://gridfinity.xyz/specification/) as implemented by
 * gridfinity-rebuilt-openscad (MIT).
 *
 * Coordinates: X = bin width, Y = bin length, Z up. The bin is centred on the
 * origin in X/Y; Z = 0 is the bottom of the feet (or of the floor without feet).
 * Interior features (cavity size, floor thickness, inlays) are free to change;
 * the outside must not.
 */

export const GRID_PITCH = 42;
export const GRID_GAP = 0.5;
export const OUTER_RADIUS = 3.75;
export const HEIGHT_UNIT = 7;

// Foot profile, bottom to top: 0.8 at 45°, 1.8 vertical, 2.15 at 45°.
export const FOOT_BOTTOM_CHAMFER = 0.8;
export const FOOT_VERTICAL = 1.8;
export const FOOT_TOP_CHAMFER = 2.15;
export const FOOT_HEIGHT = FOOT_BOTTOM_CHAMFER + FOOT_VERTICAL + FOOT_TOP_CHAMFER; // 4.75

// Stacking lip profile measured inward from the outer face, from the lip base up:
// starts 2.6 inward, 0.7 at 45° outward, 1.8 vertical, 1.9 at 45° outward to the outer face.
export const LIP_DEPTH = 2.6;
export const LIP_BOTTOM_CHAMFER = 0.7;
export const LIP_VERTICAL = 1.8;
export const LIP_TOP_CHAMFER = 1.9;
export const LIP_HEIGHT = LIP_BOTTOM_CHAMFER + LIP_VERTICAL + LIP_TOP_CHAMFER; // 4.4
// The spec lip ends in a knife edge at the outer face. Like gridfinity-rebuilt
// (0.6 mm fillet), we stop the top chamfer 0.6 mm short so the tip has a printable flat.
export const LIP_TIP = 0.6;
// Vertical section below the lip's inner tip before the 45° support starts.
export const LIP_SUPPORT_HEIGHT = 1.2;

// Walls as thick as the lip is deep: the inner face runs straight up into the lip, so
// the bin is stiff, a drop-in inlay fits the whole cavity, and the lip needs no support
// overhang. Gridfinity's own thin wall (0.95) still works for anyone who sets it.
export const DEFAULT_WALL = LIP_DEPTH;

/** Thickest wall that still leaves the lip opening free for a stacked bin's feet. */
export function maxWall({ lip }) {
  return lip ? LIP_DEPTH : Infinity;
}

const MIN_CORNER_RADIUS = 0.25;

/** Outer size of a bin body spanning `units` grid cells. */
export function outerSize(units) {
  return units * GRID_PITCH - GRID_GAP;
}

/** Inner size of the lip opening (the narrowest point a drop-in part must pass). */
export function throatSize(units) {
  return outerSize(units) - 2 * LIP_DEPTH;
}

/** Smallest unit count whose lip opening fits `innerSize` mm. */
export function unitsForInnerSize(innerSize) {
  return Math.max(1, Math.ceil((innerSize + 2 * LIP_DEPTH + GRID_GAP - 1e-6) / GRID_PITCH));
}

/** Height of the cavity floor above Z = 0. */
export function cavityBottom({ feet, floor }) {
  return (feet ? FOOT_HEIGHT : 0) + floor;
}

/** Lowest body height (excluding the lip) that still leaves a cavity below the lip support. */
export function minBodyHeight({ feet, floor, wall, lip }) {
  const supportDrop = lip ? LIP_SUPPORT_HEIGHT + Math.max(0, LIP_DEPTH - wall) : 0;
  return cavityBottom({ feet, floor }) + supportDrop + 1;
}

/**
 * Builds the bin shell as one watertight Manifold.
 *
 * @param {object} wasm - initialised manifold-3d module
 * @param {object} opts
 * @param {number} opts.unitsX - grid cells along X (width)
 * @param {number} opts.unitsY - grid cells along Y (length)
 * @param {number} opts.heightMm - total height including feet, excluding the lip
 * @param {number} [opts.wall] - wall thickness
 * @param {number} [opts.floor] - floor thickness above the feet
 * @param {boolean} [opts.lip] - add a stacking lip
 * @param {boolean} [opts.feet] - add Gridfinity feet
 * @param {number} [opts.segments] - segments per full circle for rounded corners
 * @returns {import('manifold-3d').Manifold} caller owns the result and must delete() it
 */
export function buildGridfinityBin(wasm, opts) {
  const { Manifold, CrossSection } = wasm;
  const {
    unitsX, unitsY,
    floor = 1.2,
    lip = true, feet = true, segments = 32,
  } = opts;
  const wall = Math.min(opts.wall ?? DEFAULT_WALL, maxWall({ lip }));
  const heightMm = Math.max(opts.heightMm, minBodyHeight({ feet, floor, wall, lip }));

  const garbage = [];
  const keep = (obj) => { garbage.push(obj); return obj; };

  const outerX = outerSize(unitsX);
  const outerY = outerSize(unitsY);

  const roundedRect = (sizeX, sizeY, radius) => {
    const r = Math.max(radius, MIN_CORNER_RADIUS);
    const core = keep(CrossSection.square([sizeX - 2 * r, sizeY - 2 * r], true));
    return keep(core.offset(r, 'Round', 2, segments));
  };
  // Rounded rectangle inset `d` from the bin's outer face.
  const inset = (d) => roundedRect(outerX - 2 * d, outerY - 2 * d, OUTER_RADIUS - d);
  const ringAt = (section, z) =>
    section.toPolygons().flatMap((poly) => poly.map(([x, y]) => [x, y, z]));
  // Convex loft between two rounded rectangles.
  const loft = (bottom, zBottom, top, zTop) =>
    keep(Manifold.hull([...ringAt(bottom, zBottom), ...ringAt(top, zTop)]));
  const prism = (section, zBottom, zTop) =>
    keep(keep(Manifold.extrude(section, zTop - zBottom)).translate(0, 0, zBottom));

  const parts = [];
  const bodyBottom = feet ? FOOT_HEIGHT : 0;

  if (feet) {
    const footBottomSize = GRID_PITCH - GRID_GAP - 2 * (FOOT_BOTTOM_CHAMFER + FOOT_TOP_CHAMFER);
    const footMidSize = footBottomSize + 2 * FOOT_BOTTOM_CHAMFER;
    const bottom = roundedRect(footBottomSize, footBottomSize, OUTER_RADIUS - FOOT_TOP_CHAMFER - FOOT_BOTTOM_CHAMFER);
    const mid = roundedRect(footMidSize, footMidSize, OUTER_RADIUS - FOOT_TOP_CHAMFER);
    const top = roundedRect(GRID_PITCH - GRID_GAP, GRID_PITCH - GRID_GAP, OUTER_RADIUS);
    const zMid = FOOT_BOTTOM_CHAMFER;
    const zMidTop = FOOT_BOTTOM_CHAMFER + FOOT_VERTICAL;
    const lower = keep(Manifold.hull([...ringAt(bottom, 0), ...ringAt(mid, zMid), ...ringAt(mid, zMidTop)]));
    const upper = loft(mid, zMidTop, top, FOOT_HEIGHT);
    const foot = keep(lower.add(upper));
    for (let i = 0; i < unitsX; i++) {
      for (let j = 0; j < unitsY; j++) {
        const cx = (i - (unitsX - 1) / 2) * GRID_PITCH;
        const cy = (j - (unitsY - 1) / 2) * GRID_PITCH;
        parts.push(keep(foot.translate(cx, cy, 0)));
      }
    }
  }

  const outer = inset(0);
  const bodyTop = lip ? heightMm + LIP_HEIGHT - LIP_TIP : heightMm;
  parts.push(prism(outer, bodyBottom, bodyTop));
  const solid = keep(Manifold.union(parts));

  // Everything removed from the solid: the cavity, plus the lip funnel.
  const floorZ = cavityBottom({ feet, floor });
  const cavity = inset(wall);
  const voids = [];
  if (lip) {
    // Thinner walls than the lip depth get a 45° support up to the lip opening.
    const zThroat = heightMm - LIP_SUPPORT_HEIGHT;
    const zSupport = zThroat - (LIP_DEPTH - wall);
    const throat = inset(LIP_DEPTH);
    const lipMid = inset(LIP_DEPTH - LIP_BOTTOM_CHAMFER);
    const zMid = heightMm + LIP_BOTTOM_CHAMFER;
    const zMidTop = zMid + LIP_VERTICAL;
    voids.push(prism(cavity, floorZ, zSupport + 0.01));
    if (LIP_DEPTH > wall) voids.push(loft(cavity, zSupport, throat, zThroat));
    voids.push(prism(throat, zThroat - 0.01, heightMm + 0.01));
    voids.push(loft(throat, heightMm, lipMid, zMid));
    voids.push(prism(lipMid, zMid - 0.01, zMidTop + 0.01));
    // Extend the top chamfer past the body top so the tip is cut flat at LIP_TIP.
    voids.push(loft(lipMid, zMidTop, outer, heightMm + LIP_HEIGHT));
  } else {
    voids.push(prism(cavity, floorZ, heightMm + 1));
  }
  const removed = keep(Manifold.union(voids));

  const result = solid.subtract(removed);
  for (const obj of garbage) obj.delete();
  return result;
}
