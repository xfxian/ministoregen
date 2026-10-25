import { cutOutlines, placeOutline } from '../model/pockets';
import { buildGridfinityBin } from './gridfinity';
import { buildLid, buildSnapGrooves } from './lid';

/**
 * Everything cut for a plan's models (pockets, touchpoints, finger notches) as one
 * CrossSection per pocket depth, in bin coordinates: [{ depth, section }].
 */
function pocketSections(wasm, project, plan, segments) {
  const { CrossSection } = wasm;
  const byDepth = new Map();
  for (const strip of plan.strips) {
    if (!strip.positions.length) continue;
    const outlines = cutOutlines(strip.group, project.layout, segments);
    const list = byDepth.get(strip.depth) ?? [];
    for (const position of strip.positions) {
      for (const outline of outlines) list.push(CrossSection.ofPolygons([placeOutline(outline, position)]));
    }
    byDepth.set(strip.depth, list);
  }
  return [...byDepth].map(([depth, sections]) => {
    const section = CrossSection.union(sections);
    sections.forEach((s) => s.delete());
    return { depth, section };
  });
}

/**
 * Cuts the pockets down from `top`. A pocket as deep as everything above `bottom`
 * goes right through (for the inlay); `bottom` is null where nothing may go through.
 */
function cutPockets(wasm, solid, pockets, top, bottom = null) {
  let result = solid;
  for (const { depth, section } of pockets) {
    const through = bottom !== null && top - depth <= bottom + 1e-9;
    const z0 = through ? bottom - 0.01 : top - depth;
    const prism = wasm.Manifold.extrude(section, top - z0 + 0.02);
    const placed = prism.translate(0, 0, z0);
    const next = result.subtract(placed);
    [prism, placed, result].forEach((m) => m.delete());
    section.delete();
    result = next;
  }
  return result;
}

function cutSnapGrooves(wasm, solid, plan) {
  if (!plan.lid?.snap) return solid;
  const grooves = buildSnapGrooves(wasm, plan);
  const result = solid.subtract(grooves);
  [grooves, solid].forEach((m) => m.delete());
  return result;
}

/**
 * The printable bin. In floor mode the floor is made thicker by the deepest pocket
 * and the pockets are cut into it, so bases sit at the same height in both modes.
 * A lid with snap clips needs grooves in the wall for the clips to catch in.
 */
export function buildBinPart(wasm, project, plan) {
  const { bin, layout, preview } = project;
  const floorMode = layout.pocketMode === 'floor';
  const shell = cutSnapGrooves(wasm, buildGridfinityBin(wasm, {
    unitsX: plan.unitsX,
    unitsY: plan.unitsY,
    heightMm: plan.heightMm,
    wall: bin.wall,
    floor: bin.floor + (floorMode ? plan.pocketDepth : 0),
    lip: bin.lip,
    feet: bin.feet,
    segments: preview.segments,
  }), plan);
  if (!floorMode) return shell;
  return cutPockets(wasm, shell, pocketSections(wasm, project, plan, preview.segments * 2), plan.floorZ + plan.pocketDepth);
}

/** The drop-in inlay: a rounded plate with pockets, through where they are as deep as the plate, bottom at Z = 0. */
export function buildInlayPart(wasm, project, plan) {
  const { CrossSection, Manifold } = wasm;
  const { width, length, depth, cornerRadius } = plan.inlay;
  const r = Math.max(0.1, Math.min(cornerRadius, width / 2 - 0.1, length / 2 - 0.1));
  const core = CrossSection.square([width - 2 * r, length - 2 * r], true);
  const outline = core.offset(r, 'Round', 2, project.preview.segments);
  const plate = Manifold.extrude(outline, depth);
  [core, outline].forEach((o) => o.delete());
  return cutPockets(wasm, plate, pocketSections(wasm, project, plan, project.preview.segments * 2), depth, 0);
}

/** The lid, upright as it is printed, or null when the design has none. */
export function buildLidPart(wasm, project, plan) {
  if (!plan.lid) return null;
  return buildLid(wasm, {
    unitsX: plan.unitsX,
    unitsY: plan.unitsY,
    style: plan.lid.style,
    snap: plan.lid.snap,
    segments: project.preview.segments,
  });
}
