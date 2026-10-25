/**
 * Lids that seat in a bin's stacking lip.
 *
 * The underside of every lid is one large Gridfinity foot spanning the whole bin, so a
 * lid seats in the lip exactly like a stacked bin and cannot slide off. The top is
 * either a flat plate or a grid of baseplate receptacles that other bins stack on.
 *
 * Snap clips are an add-on for either style. Each clip is a spring beam that runs
 * horizontally along the side of the plug, fixed at one end, with a barb at its free end.
 * The barb reaches past the lip opening and catches in a V-groove in the bin wall (or under
 * the lip support of a thin-walled bin), so the lid stays on when the bin is carried or
 * tipped, yet comes off with a firm pull. Because the beam bends sideways, within the print
 * layers, it does not snap off along a layer line the way an upright tab does. The clips need
 * a plug that reaches LID_SNAP_DEPTH further into the bin, which the planner adds to the
 * height clearance.
 *
 * Coordinates: like the bin, centred in X/Y, Z = 0 at the lowest point of the lid,
 * which is also the side that faces the print bed.
 */
import {
  FOOT_BOTTOM_CHAMFER, FOOT_HEIGHT, FOOT_TOP_CHAMFER, FOOT_VERTICAL, GRID_PITCH, LIP_DEPTH, LIP_HEIGHT,
  LIP_SUPPORT_HEIGHT, OUTER_RADIUS, outerSize,
} from './gridfinity';

/** A seated lid's lowest point sits this far below the lip base, like a stacked bin's feet. */
export const LID_SEAT_DROP = FOOT_HEIGHT - LIP_HEIGHT; // 0.35
/** Extra plug depth below the foot profile that carries the snap clips. */
export const LID_SNAP_DEPTH = 2.45;
/** How far a lid with snap clips reaches below the lip base. */
export const LID_SNAP_DROP = LID_SEAT_DROP + LID_SNAP_DEPTH; // 2.8

export const FLAT_LID_PLATE = 2;

// Snap clip, measured inward from the bin's outer face (u), upward from the lid bottom (z)
// and along the side from the clip centre (v).
const PLUG_INSET = FOOT_BOTTOM_CHAMFER + FOOT_TOP_CHAMFER; // 2.95, the foot bottom
const BEAM_ROOT = 1.6; // beam thickness at the fixed end, tapering towards the barb
const BEAM_TIP = 1.1;
const BEAM_SLOT = 0.8; // room behind the beam to flex into
const BEAM_HEIGHT = 3;
const BEAM_LENGTH = 16;
const BEAM_END_GAP = 0.6;
const ROOT_FILLET = 0.6;
const BARB_LENGTH = 5;
// Bridged over by the slicer, so it is generous enough not to sag onto the beam.
const BEAM_ROOF_GAP = 0.8;
const CLIP_TOP = BEAM_HEIGHT + BEAM_ROOF_GAP;
// The barb tip reaches 0.45 past the lip opening (2.6 in from the outer face), and its
// upper face runs parallel to the lip support, 0.15 mm away when the lid is seated.
const BARB_TIP_INSET = LIP_DEPTH - 0.45;
const BARB_TIP_Z = LID_SNAP_DROP - LIP_SUPPORT_HEIGHT - (LIP_DEPTH - BARB_TIP_INSET) - 0.15;
const BARB_HALF = PLUG_INSET - BARB_TIP_INSET; // 45° faces
// The groove in the bin wall continues the lip support's 45° line as its roof, so it
// catches the barb exactly like the support of a thin-walled bin does.
const GROOVE_CLEARANCE = 0.3; // below the barb, and at either end along the side
const GROOVE_LENGTH = BARB_LENGTH + 2 * GROOVE_CLEARANCE;

// Baseplate receptacles on a stackable lid (Gridfinity baseplate profile, per 42 mm cell):
// 0.7 at 45°, 1.8 vertical, 2.15 at 45°, plus a 0.6 mm recess below so feet never bottom out.
const RECEPTACLE = { bottom: 0.7, vertical: 1.8, top: 2.15, recess: 0.6, radius: 4 };
const RECEPTACLE_DEPTH = RECEPTACLE.bottom + RECEPTACLE.vertical + RECEPTACLE.top; // 4.65
// Like the lip tip, the ridges are cut flat so the outer rim keeps 0.6 mm of material.
const RECEPTACLE_TRIM = 0.85;
const MIN_FLOOR_BELOW_FOOT_TOP = 1.5;

/** Height of the lid, from its lowest point to its top. */
export function lidHeight({ style, snap }) {
  const s = snap ? LID_SNAP_DEPTH : 0;
  if (style === 'flat') return s + FOOT_HEIGHT + FLAT_LID_PLATE;
  return receptacleFloor(snap) + RECEPTACLE.recess + RECEPTACLE_DEPTH - RECEPTACLE_TRIM;
}

function receptacleFloor(snap) {
  const s = snap ? LID_SNAP_DEPTH : 0;
  const floor = s + FOOT_HEIGHT - MIN_FLOOR_BELOW_FOOT_TOP;
  // Keep solid material above the clip slots.
  return snap ? Math.max(floor, CLIP_TOP + 1.2) : floor;
}

/**
 * Where the clips sit: one per side, two on sides of three units or more. Each entry turns
 * and moves a clip built for the +X side (outer face at x = 0, inward is -x, along y).
 */
function clipPlacements(unitsX, unitsY) {
  const outerX = outerSize(unitsX);
  const outerY = outerSize(unitsY);
  const sides = [
    { angle: 0, half: outerX / 2, along: outerY, axis: [0, 1] },
    { angle: 180, half: outerX / 2, along: outerY, axis: [0, 1] },
    { angle: 90, half: outerY / 2, along: outerX, axis: [1, 0] },
    { angle: 270, half: outerY / 2, along: outerX, axis: [1, 0] },
  ];
  return sides.flatMap((side) => {
    const units = Math.round((side.along + 0.5) / GRID_PITCH);
    const offsets = units >= 3 ? [-side.along / 4, side.along / 4] : [0];
    return offsets.map((o) => ({ angle: side.angle, half: side.half, offset: [side.axis[0] * o, side.axis[1] * o, 0] }));
  });
}

/** Copies of `m` (built for the +X side at x = 0) at every clip position, as one Manifold. */
function atClips(wasm, m, unitsX, unitsY) {
  const copies = clipPlacements(unitsX, unitsY).map(({ angle, half, offset }) => {
    const shifted = m.translate(half, 0, 0);
    const turned = shifted.rotate([0, 0, angle]);
    const placed = turned.translate(...offset);
    [shifted, turned].forEach((o) => o.delete());
    return placed;
  });
  const union = wasm.Manifold.union(copies);
  copies.forEach((c) => c.delete());
  return union;
}

/** A (u, z) profile, u measured inward from the outer face, extruded along v over [v0, v1]. */
function sideProfile(wasm, points, v0, v1) {
  const section = wasm.CrossSection.ofPolygons([points.map(([u, z]) => [-u, z])], 'NonZero');
  const extruded = wasm.Manifold.extrude(section, v1 - v0);
  // Extrusion runs along +z; turn it so the profile's z is up and the length runs along +y.
  const turned = extruded.rotate([90, 0, 0]);
  const placed = turned.translate(0, v1, 0);
  [section, extruded, turned].forEach((o) => o.delete());
  return placed;
}

/**
 * The grooves a bin wall needs for a snap-clip lid, at bin height `heightMm` (the lip base).
 * Subtract the result from the bin; the caller owns it.
 */
export function buildSnapGrooves(wasm, { unitsX, unitsY, heightMm }) {
  // Roof and floor are 45° lines, z = roof0 + u and z = floor0 - u, meeting at the back.
  const roof0 = heightMm - LIP_SUPPORT_HEIGHT - LIP_DEPTH;
  const floor0 = heightMm - LID_SNAP_DROP + BARB_TIP_Z - GROOVE_CLEARANCE + BARB_TIP_INSET;
  const zRoof = (u) => roof0 + u;
  const zFloor = (u) => floor0 - u;
  const apexU = (floor0 - roof0) / 2;
  const inner = LIP_DEPTH + 0.5; // past the wall face, into the cavity
  const groove = sideProfile(wasm, [
    [apexU, zRoof(apexU)], [inner, zFloor(inner)], [inner, zRoof(inner)],
  ], -GROOVE_LENGTH / 2, GROOVE_LENGTH / 2);
  const all = atClips(wasm, groove, unitsX, unitsY);
  groove.delete();
  return all;
}

/**
 * @param {object} wasm - initialised manifold-3d module
 * @param {object} opts
 * @param {number} opts.unitsX
 * @param {number} opts.unitsY
 * @param {'flat'|'stackable'} opts.style
 * @param {boolean} [opts.snap]
 * @param {number} [opts.segments]
 * @returns {import('manifold-3d').Manifold} caller owns the result and must delete() it
 */
export function buildLid(wasm, { unitsX, unitsY, style, snap = false, segments = 32 }) {
  const { Manifold, CrossSection } = wasm;
  const garbage = [];
  const keep = (obj) => { garbage.push(obj); return obj; };
  const outerX = outerSize(unitsX);
  const outerY = outerSize(unitsY);

  const roundedRect = (sizeX, sizeY, radius) => {
    const r = Math.max(radius, 0.25);
    const core = keep(CrossSection.square([sizeX - 2 * r, sizeY - 2 * r], true));
    return keep(core.offset(r, 'Round', 2, segments));
  };
  const inset = (d) => roundedRect(outerX - 2 * d, outerY - 2 * d, OUTER_RADIUS - d);
  const ringAt = (section, z) => section.toPolygons().flatMap((poly) => poly.map(([x, y]) => [x, y, z]));
  const hull = (...rings) => keep(Manifold.hull(rings.flatMap(([section, z]) => ringAt(section, z))));
  const prism = (section, zBottom, zTop) =>
    keep(keep(Manifold.extrude(section, zTop - zBottom)).translate(0, 0, zBottom));

  const s = snap ? LID_SNAP_DEPTH : 0;
  const footBottom = inset(PLUG_INSET);
  const footMid = inset(FOOT_TOP_CHAMFER);
  const outer = inset(0);
  const zMid = s + FOOT_BOTTOM_CHAMFER;
  const zMidTop = zMid + FOOT_VERTICAL;
  const zTop = s + FOOT_HEIGHT;
  const height = lidHeight({ style, snap });

  const parts = [
    hull([footBottom, s], [footMid, zMid], [footMid, zMidTop]),
    hull([footMid, zMidTop], [outer, zTop]),
    prism(outer, zTop - 0.01, height),
  ];
  if (snap) parts.push(prism(footBottom, 0, s + 0.01));
  let lid = keep(Manifold.union(parts));

  if (style === 'stackable') {
    const cells = [];
    const floor = receptacleFloor(snap);
    const zp = floor + RECEPTACLE.recess;
    const cell = (d) => roundedRect(GRID_PITCH - 2 * d, GRID_PITCH - 2 * d, RECEPTACLE.radius - d);
    const bottomInset = RECEPTACLE.bottom + RECEPTACLE.top;
    const pocket = keep(Manifold.union([
      prism(cell(bottomInset), floor, zp + 0.01),
      hull([cell(bottomInset), zp], [cell(RECEPTACLE.top), zp + RECEPTACLE.bottom]),
      prism(cell(RECEPTACLE.top), zp + RECEPTACLE.bottom - 0.01, zp + RECEPTACLE.bottom + RECEPTACLE.vertical + 0.01),
      // The top chamfer continues past the lid top so the ridges are trimmed flat.
      hull([cell(RECEPTACLE.top), zp + RECEPTACLE.bottom + RECEPTACLE.vertical], [cell(-1), zp + RECEPTACLE_DEPTH + 1]),
    ]));
    for (let i = 0; i < unitsX; i++) {
      for (let j = 0; j < unitsY; j++) {
        cells.push(keep(pocket.translate((i - (unitsX - 1) / 2) * GRID_PITCH, (j - (unitsY - 1) / 2) * GRID_PITCH, 0)));
      }
    }
    lid = keep(lid.subtract(keep(Manifold.union(cells))));
  }

  if (snap) {
    const vTip = BARB_LENGTH / 2;
    const vRoot = vTip - BEAM_LENGTH;
    const back = PLUG_INSET + BEAM_ROOT + BEAM_SLOT;
    // Cleared space around the beam: from outside the lid to behind the slot, up to a roof
    // the slicer bridges across between the solid plug on either end.
    const cut = keep(sideProfile(wasm, [[-1, -0.01], [back, -0.01], [back, CLIP_TOP], [-1, CLIP_TOP]],
      vRoot, vTip + BEAM_END_GAP));
    // The beam in plan view (u, v): just inside the plug face, tapering towards the free end,
    // with a fillet where it grows out of the plug. Its root is buried in the plug, so no face
    // lines up with one of the plug's.
    const face = PLUG_INSET + 0.05;
    const beamPlan = keep(CrossSection.ofPolygons([[
      [face, vRoot - 1],
      [face + BEAM_ROOT + ROOT_FILLET + 0.3, vRoot - 1],
      [face + BEAM_ROOT + ROOT_FILLET + 0.3, vRoot - 0.3],
      [face + BEAM_ROOT, vRoot + ROOT_FILLET],
      [face + BEAM_TIP, vTip],
      [face, vTip],
    ].map(([u, v]) => [-u, v])], 'NonZero'));
    const beam = keep(Manifold.extrude(beamPlan, BEAM_HEIGHT));
    const barb = keep(sideProfile(wasm, [
      [BARB_TIP_INSET, BARB_TIP_Z],
      [PLUG_INSET, BARB_TIP_Z - BARB_HALF],
      [PLUG_INSET + 0.2, BARB_TIP_Z - BARB_HALF],
      [PLUG_INSET + 0.2, BARB_TIP_Z + BARB_HALF],
      [PLUG_INSET, BARB_TIP_Z + BARB_HALF],
    ], vTip - BARB_LENGTH, vTip));
    const clip = keep(beam.add(barb));
    lid = keep(keep(lid.subtract(keep(atClips(wasm, cut, unitsX, unitsY)))).add(keep(atClips(wasm, clip, unitsX, unitsY))));
  }

  garbage.splice(garbage.indexOf(lid), 1);
  for (const obj of garbage) obj.delete();
  return lid;
}
