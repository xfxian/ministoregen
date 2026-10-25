import { placeOutline, pocketOutline } from '../model/pockets';
import { buildGridfinityBin } from './gridfinity';
import { buildLid, buildSnapGrooves } from './lid';

/** Union of all pocket outlines of a plan as one CrossSection, in bin coordinates. */
function pocketSection(wasm, project, plan, segments) {
  const { CrossSection } = wasm;
  const sections = [];
  for (const strip of plan.strips) {
    if (!strip.positions.length) continue;
    const outline = pocketOutline(strip.group, project.layout, segments);
    for (const position of strip.positions) sections.push(CrossSection.ofPolygons([placeOutline(outline, position)]));
  }
  if (!sections.length) return null;
  const union = CrossSection.union(sections);
  sections.forEach((s) => s.delete());
  return union;
}

function cutPockets(wasm, solid, pockets, zBottom, depth) {
  if (!pockets) return solid;
  const prism = wasm.Manifold.extrude(pockets, depth + 0.02);
  const placed = prism.translate(0, 0, zBottom);
  const result = solid.subtract(placed);
  [prism, placed, solid].forEach((m) => m.delete());
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
 * The printable bin. In floor mode the floor is made thicker by the pocket depth
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
    floor: bin.floor + (floorMode ? layout.pocketDepth : 0),
    lip: bin.lip,
    feet: bin.feet,
    segments: preview.segments,
  }), plan);
  if (!floorMode) return shell;
  const pockets = pocketSection(wasm, project, plan, preview.segments * 2);
  const result = cutPockets(wasm, shell, pockets, plan.floorZ, layout.pocketDepth);
  pockets?.delete();
  return result;
}

/** The drop-in inlay: a rounded plate with through pockets, bottom at Z = 0. */
export function buildInlayPart(wasm, project, plan) {
  const { CrossSection, Manifold } = wasm;
  const { width, length, depth, cornerRadius } = plan.inlay;
  const r = Math.max(0.1, Math.min(cornerRadius, width / 2 - 0.1, length / 2 - 0.1));
  const core = CrossSection.square([width - 2 * r, length - 2 * r], true);
  const outline = core.offset(r, 'Round', 2, project.preview.segments);
  const plate = Manifold.extrude(outline, depth);
  [core, outline].forEach((o) => o.delete());
  const pockets = pocketSection(wasm, project, plan, project.preview.segments * 2);
  const result = cutPockets(wasm, plate, pockets, -0.01, depth);
  pockets?.delete();
  return result;
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
