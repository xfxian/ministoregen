import { BASE_HEIGHT, LIP_HEIGHT } from '../binGeometry';
import { GRIDFINITY_UNIT, GRIDFINITY_SPACER, GRIDFINITY_WALL_THICKNESS, GRIDFINITY_HEIGHT_UNIT } from '../config';

export const BASE_PRESETS = {
  round: [
    { label: '25mm',  sizeX: 25, sizeY: 25 },
    { label: '28mm',  sizeX: 28, sizeY: 28 },
    { label: '32mm',  sizeX: 32, sizeY: 32 },
    { label: '40mm',  sizeX: 40, sizeY: 40 },
    { label: '50mm',  sizeX: 50, sizeY: 50 },
    { label: '60mm',  sizeX: 60, sizeY: 60 },
    { label: '65mm',  sizeX: 65, sizeY: 65 },
  ],
  oval: [
    { label: '25×50mm',  sizeX: 25, sizeY: 50  },
    { label: '40×75mm',  sizeX: 40, sizeY: 75  },
    { label: '60×95mm',  sizeX: 60, sizeY: 95  },
    { label: '90×120mm', sizeX: 90, sizeY: 120 },
  ],
};

export const GROUP_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

/**
 * Returns the total bin height required to fit all groups (tallest wins).
 * Returns null when groups is empty (caller should not override existing config).
 */
export function calcBinHeightFromGroups(groups, floorThickness, stackingLip) {
  if (groups.length === 0) return null;
  const tallest = Math.max(...groups.map((g) => g.heightMm));
  return BASE_HEIGHT + floorThickness + tallest + (stackingLip ? LIP_HEIGHT : 0);
}

/**
 * Returns the minimum *strip* length (mm) needed to fit `count` holes of size
 * sizeX×sizeY, given the width that hexagonalLayout will receive
 * (i.e. inlay.width − inlay.clearance).
 *
 * "Strip length" is what computeSectionStrips allocates per section within the
 * inlay's usable area. hexagonalLayout subtracts 2×margin from this value
 * internally, so we return (hexUsable + 2×margin + ε) — not the full inlay length.
 * The caller derives inlay.length as: totalStrip + inlay.clearance + 2×margin.
 */
export function calcMinSectionLength(count, widthWithClearance, sizeX, sizeY, spacing, clearance, margin) {
  if (count <= 0) return 2 * margin; // empty strip still needs its internal margin

  const holeDiameterX = sizeX + clearance;
  const holeDiameterY = sizeY + clearance;
  const s = holeDiameterY / Math.sqrt(3);
  const colSpacing = holeDiameterX + spacing / 2;
  const rowHeight = 1.5 * s + spacing / 2;
  const usableWidth = widthWithClearance - 2 * margin;
  const numCols = Math.floor(usableWidth / colSpacing);

  // Small epsilon guards against floating-point floor cutting off the last row
  const EPS = 0.01;

  if (numCols <= 0) {
    // Base wider than available width — size by height only
    return count * (holeDiameterY + spacing / 2) + 2 * margin + EPS;
  }

  if (numCols === 1) {
    const singleRowHeight = holeDiameterY + spacing / 2;
    return count * singleRowHeight + 2 * margin + EPS;
  }

  // Hex layout: even rows have numCols holes; odd rows have numCols − 1.
  let holes = 0;
  let rows = 0;
  while (holes < count) {
    holes += rows % 2 === 0 ? numCols : numCols - 1;
    rows++;
  }
  return rows * rowHeight + 2 * margin + EPS;
}

/**
 * Converts wizard groups into inlay section objects.
 * Shares and inlay length are calculated by the caller using calcMinSectionLength.
 * Returns null when groups is empty.
 */
export function groupsToSections(groups) {
  if (groups.length === 0) return null;
  const totalWeight = groups.reduce(
    (sum, g) => sum + g.count * Math.max(g.baseSizeX, g.baseSizeY),
    0
  );
  return groups.map((g) => ({
    share: (g.count * Math.max(g.baseSizeX, g.baseSizeY) / totalWeight) * 100,
    sizeX: g.baseSizeX,
    sizeY: g.baseSizeY,
    curvatureFactor: g.baseSizeX === g.baseSizeY ? 0.55 : 0.45,
    spacing: 1,
    clearance: 0.4,
    miniatureHeightMm: g.heightMm,
    miniatureCount: g.count,
    color: g.color,
  }));
}

/**
 * Snaps an inlay length to the smallest Gridfinity-compatible interior dimension
 * that is >= lengthMm. Interior = n×42 − 0.5 − 2×1.8.
 */
export function snapToGridfinityLength(lengthMm) {
  const n = Math.ceil((lengthMm + GRIDFINITY_SPACER + 2 * GRIDFINITY_WALL_THICKNESS) / GRIDFINITY_UNIT);
  return Math.max(1, n) * GRIDFINITY_UNIT - GRIDFINITY_SPACER - 2 * GRIDFINITY_WALL_THICKNESS;
}

/**
 * Snaps a bin height to the next multiple of the Gridfinity height unit (7 mm).
 */
export function snapToGridfinityHeight(heightMm) {
  return Math.ceil(heightMm / GRIDFINITY_HEIGHT_UNIT) * GRIDFINITY_HEIGHT_UNIT;
}

export function makeDefaultGroup(index) {
  return {
    id: Date.now() + index,
    count: 5,
    baseSizeX: 40,
    baseSizeY: 40,
    heightMm: 30,
    color: GROUP_COLORS[index % GROUP_COLORS.length],
  };
}
