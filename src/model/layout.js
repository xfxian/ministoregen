import {
  FOOT_HEIGHT, GRID_GAP, GRID_PITCH, HEIGHT_UNIT, LIP_HEIGHT, cavityBottom, minBodyHeight, outerSize, throatSize,
  unitsForInnerSize,
} from '../geometry/gridfinity';

/** When bins stack, the upper bin's feet reach this far below the lower bin's lip base. */
export const STACKED_FOOT_DROP = FOOT_HEIGHT - LIP_HEIGHT;

const SQRT3_2 = Math.sqrt(3) / 2;

function pocketSize(group, layout) {
  return { dx: group.sizeX + layout.baseClearance, dy: group.sizeY + layout.baseClearance };
}

/**
 * Pocket centres for one group inside a strip of `stripLength` × `width` (already
 * inside the margin), centred on (0, centerY). Round and oval bases try both a
 * staggered (hex) and a straight grid and keep whichever holds more.
 */
export function layoutStrip(group, layout, stripLength, width, centerY = 0) {
  const candidates = packings(group, layout).map((p) => arrange(p, stripLength, width, centerY));
  return candidates.reduce((best, c) => (c.length > best.length ? c : best), []);
}

function packings(group, layout) {
  const { dx, dy } = pocketSize(group, layout);
  const g = layout.spacing;
  const grid = { dx, dy, colStep: dx + g, rowStep: dy + g, stagger: false };
  if (group.shape === 'square' || group.shape === 'rect') return [grid];
  return [{ dx, dy, colStep: dx + g, rowStep: (dy + g) * SQRT3_2, stagger: true }, grid];
}

function countFit(size, pitch, available) {
  return available + 1e-9 < size ? 0 : Math.floor((available - size + 1e-9) / pitch) + 1;
}

function arrange({ dx, dy, colStep, rowStep, stagger }, stripLength, width, centerY) {
  const evenCols = countFit(dx, colStep, width);
  const oddCols = stagger ? countFit(dx, colStep, width - colStep / 2) : evenCols;
  const rows = countFit(dy, rowStep, stripLength);
  // A staggered layout needs at least two columns to save any space.
  if (evenCols === 0 || rows === 0 || (stagger && evenCols < 2)) return [];
  // Odd rows sit half a step to the right; when they have the same column count
  // the pattern gets half a step wider.
  const patternWidth = (evenCols - 1) * colStep + (stagger && oddCols === evenCols ? colStep / 2 : 0);
  const patternHeight = (rows - 1) * rowStep;
  const positions = [];
  for (let r = 0; r < rows; r++) {
    const odd = stagger && r % 2 === 1;
    const cols = odd ? oddCols : evenCols;
    const x0 = -patternWidth / 2 + (odd ? colStep / 2 : 0);
    const y = centerY - patternHeight / 2 + r * rowStep;
    for (let c = 0; c < cols; c++) positions.push([x0 + c * colStep, y]);
  }
  return positions;
}

/** Shortest strip that holds `group.count` pockets at the given width, or Infinity. */
export function minStripLength(group, layout, width) {
  let best = Infinity;
  for (const p of packings(group, layout)) {
    for (let rows = 1; rows <= 500; rows++) {
      const length = (rows - 1) * p.rowStep + p.dy + layout.spacing;
      if (length >= best) break;
      if (arrange(p, length, width, 0).length >= group.count) {
        best = length;
        break;
      }
      if (rows === 1 && arrange(p, length, width, 0).length === 0) break;
    }
  }
  return best;
}

/**
 * Size of the area pockets are laid out in, along one axis:
 * the drop-in inlay (which must pass the stacking lip opening), or the bin floor.
 */
function areaSize(units, bin, layout) {
  return layout.pocketMode === 'floor'
    ? outerSize(units) - 2 * bin.wall
    : throatSize(units) - layout.inlayClearance;
}

function usableSize(units, bin, layout) {
  return areaSize(units, bin, layout) - 2 * layout.margin;
}

/** Smallest unit count whose area holds strips of the given total length. */
function unitsForStrips(needs, bin, layout) {
  const length = needs.reduce((a, b) => a + b, 0) + 2 * layout.margin;
  if (layout.pocketMode === 'floor') {
    return Math.max(1, Math.ceil((length + 2 * bin.wall + GRID_GAP - 1e-6) / GRID_PITCH));
  }
  return unitsForInnerSize(length + layout.inlayClearance);
}

function chooseFootprint(groups, bin, layout) {
  if (!bin.autoFootprint) return { unitsX: bin.unitsX, unitsY: bin.unitsY, fitsOneBin: true };
  let best = null;
  for (let ux = 1; ux <= bin.maxUnits; ux++) {
    const needs = groups.map((g) => minStripLength(g, layout, usableSize(ux, bin, layout)));
    if (needs.some((n) => !Number.isFinite(n))) continue;
    const uy = unitsForStrips(needs, bin, layout);
    if (uy > bin.maxUnits) continue;
    // Smallest area first, then the squarer bin, then the one that is longer than wide.
    const score = [ux * uy, Math.abs(ux - uy), ux > uy ? 1 : 0];
    if (!best || compare(score, best.score) < 0) best = { unitsX: ux, unitsY: uy, score };
  }
  if (!best) return { unitsX: bin.maxUnits, unitsY: bin.maxUnits, fitsOneBin: false };
  return { unitsX: best.unitsX, unitsY: best.unitsY, fitsOneBin: true };
}

function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/**
 * Derives everything the app shows and exports from the project: bin size and
 * height, inlay size, pocket positions per group, and warnings with suggested fixes.
 */
export function planProject(project) {
  const { groups, bin, layout } = project;
  const warnings = [];
  const { unitsX, unitsY, fitsOneBin } = groups.length
    ? chooseFootprint(groups, bin, layout)
    : { unitsX: bin.autoFootprint ? 1 : bin.unitsX, unitsY: bin.autoFootprint ? 1 : bin.unitsY, fitsOneBin: true };

  if (!fitsOneBin) {
    warnings.push({
      id: 'too-big',
      severity: 'error',
      text: `This collection does not fit in one bin up to ${bin.maxUnits} × ${bin.maxUnits} units. Split it into several projects or allow larger bins.`,
      fix: { label: `Allow up to ${bin.maxUnits + 2} units`, bin: { maxUnits: bin.maxUnits + 2 } },
    });
  }

  const area = { width: areaSize(unitsX, bin, layout), length: areaSize(unitsY, bin, layout) };
  const inlay = layout.pocketMode === 'inlay'
    ? { ...area, depth: layout.inlayDepth, cornerRadius: layout.inlayCornerRadius }
    : null;
  const usableW = area.width - 2 * layout.margin;
  const usableL = area.length - 2 * layout.margin;

  const needs = groups.map((g) => minStripLength(g, layout, usableW));
  const finiteNeeds = needs.map((n) => (Number.isFinite(n) ? n : 0));
  const totalNeed = finiteNeeds.reduce((a, b) => a + b, 0);
  const scale = totalNeed > 0 ? usableL / totalNeed : 0;
  let cursor = -usableL / 2;
  const strips = groups.map((group, i) => {
    const length = finiteNeeds[i] * scale;
    const centerY = cursor + length / 2;
    cursor += length;
    const positions = length > 0 ? layoutStrip(group, layout, length, usableW, centerY) : [];
    return { group, centerY, length, positions, capacity: positions.length };
  });

  strips.forEach(({ group, capacity }, i) => {
    if (!Number.isFinite(needs[i])) {
      warnings.push({
        id: `wide-${group.id}`,
        severity: 'error',
        groupId: group.id,
        text: `${group.name}: a ${group.sizeX} × ${group.sizeY} mm base is wider than this bin.`,
        fix: bin.autoFootprint ? undefined : { label: 'Size the bin automatically', bin: { autoFootprint: true } },
      });
    } else if (capacity < group.count) {
      warnings.push({
        id: `count-${group.id}`,
        severity: 'error',
        groupId: group.id,
        text: `${group.name}: only ${capacity} of ${group.count} fit.`,
        fix: bin.autoFootprint ? undefined : { label: 'Size the bin automatically', bin: { autoFootprint: true } },
      });
    }
  });

  const floorZ = cavityBottom({ feet: bin.feet, floor: bin.floor });
  const drop = bin.lip ? STACKED_FOOT_DROP : 0;
  const tallest = groups.reduce((m, g) => Math.max(m, g.heightMm), 0);
  const minHeight = minBodyHeight({ feet: bin.feet, floor: bin.floor, wall: bin.wall, lip: bin.lip });
  const neededHeight = Math.max(floorZ + tallest + drop, minHeight);
  const neededUnits = Math.ceil(neededHeight / HEIGHT_UNIT - 1e-9);
  const heightUnits = bin.autoHeight ? neededUnits : bin.heightUnits;
  const heightMm = Math.max(heightUnits * HEIGHT_UNIT, minHeight);

  groups.forEach((g) => {
    const over = floorZ + g.heightMm + drop - heightMm;
    if (over > 1e-6) {
      warnings.push({
        id: `tall-${g.id}`,
        severity: 'warning',
        groupId: g.id,
        text: `${g.name} is ${over.toFixed(1)} mm taller than the bin${bin.lip ? ' when bins are stacked' : ''}.`,
        fix: { label: `Raise to ${neededUnits}u`, bin: { autoHeight: false, heightUnits: neededUnits } },
      });
    }
  });

  return { unitsX, unitsY, heightUnits, heightMm, area, inlay, strips, warnings, floorZ };
}
