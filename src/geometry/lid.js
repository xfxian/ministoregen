/**
 * Lids that seat in a bin's stacking lip.
 *
 * The underside of every lid is one large Gridfinity foot spanning the whole bin, so a
 * lid seats in the lip exactly like a stacked bin and cannot slide off. The top is
 * either a flat plate or a grid of baseplate receptacles that other bins stack on.
 *
 * Snap clips are an add-on for either style: flexible tabs reach through the lip
 * opening and catch under the lip's 45° support, so the lid stays on when the bin is
 * carried or tipped, yet comes off with a firm pull. They need a plug that reaches
 * LID_SNAP_DEPTH further into the bin, which the planner adds to the height clearance.
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

// Snap clip, measured inward from the bin's outer face and upward from the lid bottom.
const PLUG_INSET = FOOT_BOTTOM_CHAMFER + FOOT_TOP_CHAMFER; // 2.95, the foot bottom
const TAB_THICKNESS = 1.2;
const TAB_SLOT = 0.8; // room behind the tab to flex into
const TAB_SLIT = 0.6;
const TAB_WIDTH = 8;
const TAB_TOP = LID_SNAP_DROP + 3.7; // tab root, inside the foot profile
// The barb tip reaches 0.45 past the lip opening (2.6 in from the outer face), and its
// upper face runs parallel to the lip support, 0.15 mm away when the lid is seated.
const BARB_TIP_INSET = LIP_DEPTH - 0.45;
const BARB_TIP_Z = LID_SNAP_DROP - LIP_SUPPORT_HEIGHT - (LIP_DEPTH - BARB_TIP_INSET) - 0.15;
const BARB_HALF = PLUG_INSET - BARB_TIP_INSET; // 45° faces

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
  return snap ? Math.max(floor, TAB_TOP + 1.2) : floor;
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
    const cuts = [];
    const tabs = [];
    const barbProfile = keep(CrossSection.ofPolygons([[
      [0, BARB_TIP_Z - BARB_HALF],
      [BARB_HALF, BARB_TIP_Z],
      [0, BARB_TIP_Z + BARB_HALF],
      [-0.2, BARB_TIP_Z + BARB_HALF],
      [-0.2, BARB_TIP_Z - BARB_HALF],
    ]]));
    // One clip per side, two on sides of three units or more. Built for the +X side
    // (outer face at x = 0, inward is -x, along y), then moved into place.
    const clip = (halfOuter) => {
      const cut = keep(Manifold.cube([PLUG_INSET + TAB_THICKNESS + TAB_SLOT + 1, TAB_WIDTH + 2 * TAB_SLIT, TAB_TOP + 0.01]))
        .translate(-(PLUG_INSET + TAB_THICKNESS + TAB_SLOT), -(TAB_WIDTH / 2 + TAB_SLIT), -0.01);
      const tab = keep(Manifold.cube([TAB_THICKNESS, TAB_WIDTH, TAB_TOP + 0.02]))
        .translate(-(PLUG_INSET + TAB_THICKNESS), -TAB_WIDTH / 2, 0);
      // Extrude the barb profile (x, z) along y.
      const barb = keep(Manifold.extrude(barbProfile, TAB_WIDTH)).rotate([90, 0, 0]).translate(-PLUG_INSET, TAB_WIDTH / 2, 0);
      const shift = (m) => keep(keep(m).translate(halfOuter, 0, 0));
      return { cut: shift(cut), tab: keep(Manifold.union([shift(tab), shift(barb)])) };
    };
    const place = (m, angle, offset) => keep(keep(m.rotate([0, 0, angle])).translate(...offset));
    const sides = [
      { angle: 0, half: outerX / 2, along: outerY, axis: [0, 1] },
      { angle: 180, half: outerX / 2, along: outerY, axis: [0, 1] },
      { angle: 90, half: outerY / 2, along: outerX, axis: [1, 0] },
      { angle: 270, half: outerY / 2, along: outerX, axis: [1, 0] },
    ];
    for (const side of sides) {
      const units = Math.round((side.along + 0.5) / GRID_PITCH);
      const offsets = units >= 3 ? [-side.along / 4, side.along / 4] : [0];
      const { cut, tab } = clip(side.half);
      for (const o of offsets) {
        const offset = [side.axis[0] * o, side.axis[1] * o, 0];
        cuts.push(place(cut, side.angle, offset));
        tabs.push(place(tab, side.angle, offset));
      }
    }
    lid = keep(keep(lid.subtract(keep(Manifold.union(cuts)))).add(keep(Manifold.union(tabs))));
  }

  garbage.splice(garbage.indexOf(lid), 1);
  for (const obj of garbage) obj.delete();
  return lid;
}
