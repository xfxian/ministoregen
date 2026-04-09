export const DRAWER_WIDTH = 400;

export const DEFAULT_SECTION = {
  sizeX: 25,
  sizeY: 25,
  curvatureFactor: 0.55,
  spacing: 1,
  clearance: 0.4,
  miniatureHeightMm: 0,
  color: '#e74c3c',
};

export const DEFAULT_INLAY = {
  length: 121.9,
  width: 79.9,
  cornerRadius: 3.2,
  depth: 3,
  margin: 1,
  clearance: 0.2
};

// Gridfinity bin dimensions
// Note: every bin manufacturer is slightly different; these values are a common baseline.
const GRIDFINITY_UNIT = 42;
const GRIDFINITY_SPACER = 0.5;
export const GRIDFINITY_WALL_THICKNESS = 1.8;
export const GRIDFINITY_HEIGHT_UNIT = 7; // mm per gridfinity height unit

export const DEFAULT_BIN_CONFIG = {
  enabled: false,
  wallThickness: 1.8,
  floorThickness: 1.2,
  heightMm: 28, // 4 gridfinity height units
  stackingLip: true,
  baseFeet: false,
  cornerSegments: 32,
};

export const GRIDFINITY_DIMENSION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map(n => [
  (n * GRIDFINITY_UNIT) - GRIDFINITY_SPACER - (2 * GRIDFINITY_WALL_THICKNESS),
  n
]);

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
