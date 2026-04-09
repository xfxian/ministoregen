import { BASE_HEIGHT, LIP_HEIGHT } from '../binGeometry';

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
 * Converts wizard groups into inlay section objects.
 * Section share is proportional to count × max(sizeX, sizeY) (1-D packing weight).
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
    color: g.color,
  }));
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
