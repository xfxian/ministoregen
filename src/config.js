import { DEFAULT_WALL, HEIGHT_UNIT, throatSize } from './geometry/gridfinity';

export const DRAWER_WIDTH = 400;

export const DEFAULT_SECTION = {
  sizeX: 25,
  sizeY: 25,
  curvatureFactor: 0.55,
  spacing: 1,
  clearance: 0.4,
  miniatureHeightMm: 0,
  miniatureCount: 0,
  color: '#e74c3c',
};

// Default inlay fits through the stacking lip of a 3×2 Gridfinity bin.
export const DEFAULT_INLAY = {
  length: throatSize(3),
  width: throatSize(2),
  cornerRadius: 3.2,
  depth: 3,
  margin: 1,
  clearance: 0.5
};

export const GRIDFINITY_HEIGHT_UNIT = HEIGHT_UNIT; // mm per Gridfinity height unit

export const DEFAULT_BIN_CONFIG = {
  enabled: false,
  wallThickness: DEFAULT_WALL,
  floorThickness: 1.2,
  heightMm: 28, // 4 Gridfinity height units, including feet, excluding the stacking lip
  stackingLip: true,
  baseFeet: true,
  cornerSegments: 32,
};

// Inlay sizes that fit through the stacking lip of a bin n units long.
export const GRIDFINITY_DIMENSION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map(n => [throatSize(n), n]);

export const SELECT_ITEMS = {
  gridfinity: {
    length: {
      options: GRIDFINITY_DIMENSION_OPTIONS,
      unit: 'u',
      help: 'Length of your Gridfinity bin'
    },
    width: {
      options: GRIDFINITY_DIMENSION_OPTIONS,
      unit: 'u',
      help: 'Width of your Gridfinity bin'
    }
  },
  '40k': {
    size: {
      options: [
        [25, '25'],
        [28, '28'],
        [32, '32'],
        [40, '40']
      ],
      unit: 'mm'
    }
  }
};
