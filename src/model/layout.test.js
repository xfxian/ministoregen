import { describe, expect, it } from 'vitest';
import { HEIGHT_UNIT, throatSize } from '../geometry/gridfinity';
import { STACKED_FOOT_DROP, layoutStrip, minStripLength, planProject } from './layout';
import { DEFAULT_LAYOUT, decodeProject, encodeProject, makeDefaultProject, makeGroup, normalizeProject } from './project';

const layout = DEFAULT_LAYOUT;

function project(groups, bin = {}) {
  const p = makeDefaultProject();
  return { ...p, groups, bin: { ...p.bin, ...bin } };
}

function noOverlap(positions, dx, dy) {
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const [x1, y1] = positions[i];
      const [x2, y2] = positions[j];
      // Ellipse overlap test in normalised space (pockets as ellipses of dx × dy).
      const d = Math.hypot((x1 - x2) / dx, (y1 - y2) / dy);
      if (d < 1 - 1e-6) return false;
    }
  }
  return true;
}

describe('layoutStrip', () => {
  const group = makeGroup(0, { sizeX: 25, sizeY: 25 });

  it('keeps pockets inside the strip and apart from each other', () => {
    const positions = layoutStrip(group, layout, 100, 80, 0);
    const d = 25 + layout.baseClearance;
    expect(positions.length).toBeGreaterThan(0);
    for (const [x, y] of positions) {
      expect(Math.abs(x) + d / 2).toBeLessThanOrEqual(40 + 1e-6);
      expect(Math.abs(y) + d / 2).toBeLessThanOrEqual(50 + 1e-6);
    }
    expect(noOverlap(positions, d + layout.spacing, d + layout.spacing)).toBe(true);
  });

  it('uses a straight grid for square bases', () => {
    const square = makeGroup(0, { shape: 'square', sizeX: 25, sizeY: 25 });
    const positions = layoutStrip(square, layout, 60, 60, 0);
    const xs = new Set(positions.map(([x]) => x.toFixed(3)));
    expect(xs.size).toBe(2);
    expect(positions).toHaveLength(4);
  });

  it('returns nothing when the base is wider than the strip', () => {
    expect(layoutStrip(makeGroup(0, { sizeX: 100, sizeY: 100 }), layout, 200, 50)).toEqual([]);
  });
});

describe('minStripLength', () => {
  // The strip length includes one spacing gap towards the next group.
  it('returns the shortest length that holds the requested count', () => {
    const group = makeGroup(0, { sizeX: 32, sizeY: 32, count: 9 });
    const length = minStripLength(group, layout, 76);
    expect(layoutStrip(group, layout, length, 76).length).toBeGreaterThanOrEqual(9);
    expect(layoutStrip(group, layout, length - layout.spacing - 0.01, 76).length).toBeLessThan(9);
  });
});

describe('planProject', () => {
  it('sizes the smallest bin that fits every group', () => {
    const plan = planProject(project([
      makeGroup(0, { sizeX: 32, sizeY: 32, count: 10 }),
      makeGroup(1, { sizeX: 60, sizeY: 60, count: 1 }),
    ]));
    expect(plan.warnings.filter((w) => w.severity === 'error')).toEqual([]);
    plan.strips.forEach((s) => expect(s.capacity).toBeGreaterThanOrEqual(s.group.count));
    expect(plan.inlay.width).toBeCloseTo(throatSize(plan.unitsX) - layout.inlayClearance);
    // One unit less in either direction must not fit.
    const smallerX = planProject(project(plan.strips.map((s) => s.group), {
      autoFootprint: false, unitsX: plan.unitsX - 1, unitsY: plan.unitsY,
    }));
    const smallerY = planProject(project(plan.strips.map((s) => s.group), {
      autoFootprint: false, unitsX: plan.unitsX, unitsY: plan.unitsY - 1,
    }));
    expect(plan.unitsX === 1 || smallerX.warnings.some((w) => w.severity === 'error')).toBe(true);
    expect(plan.unitsY === 1 || smallerY.warnings.some((w) => w.severity === 'error')).toBe(true);
  });

  it('warns when a fixed bin is too small and offers to size it automatically', () => {
    const plan = planProject(project([makeGroup(0, { count: 40 })], { autoFootprint: false, unitsX: 1, unitsY: 1 }));
    const warning = plan.warnings.find((w) => w.id.startsWith('count-'));
    expect(warning.text).toMatch(/only \d+ of 40 fit/);
    expect(warning.fix.bin).toEqual({ autoFootprint: true });
  });

  it('picks a height that clears the tallest miniature with a bin stacked on top', () => {
    const plan = planProject(project([makeGroup(0, { heightMm: 30 }), makeGroup(1, { heightMm: 52 })]));
    expect(plan.heightMm % HEIGHT_UNIT).toBe(0);
    expect(plan.floorZ + 52 + STACKED_FOOT_DROP).toBeLessThanOrEqual(plan.heightMm);
    expect(plan.floorZ + 52 + STACKED_FOOT_DROP).toBeGreaterThan(plan.heightMm - HEIGHT_UNIT);
  });

  it('warns about miniatures taller than a fixed height', () => {
    const plan = planProject(project([makeGroup(0, { name: 'Dreadnought', heightMm: 60 })], { autoHeight: false, heightUnits: 6 }));
    const warning = plan.warnings.find((w) => w.id.startsWith('tall-'));
    expect(warning.text).toMatch(/^Dreadnought is [\d.]+ mm taller/);
    expect(warning.fix.bin.heightUnits).toBeGreaterThan(6);
  });

  it('reports collections that need more than one bin', () => {
    const plan = planProject(project([makeGroup(0, { sizeX: 60, sizeY: 60, count: 60 })]));
    expect(plan.warnings[0].id).toBe('too-big');
  });
});

describe('pocket modes', () => {
  it('fits more pockets in the bin floor than in a drop-in inlay of the same bin', () => {
    const groups = [makeGroup(0, { sizeX: 25, sizeY: 25, count: 1 })];
    const fixed = { autoFootprint: false, unitsX: 2, unitsY: 3 };
    const inlayPlan = planProject(project(groups, fixed));
    const floorPlan = planProject({ ...project(groups, fixed), layout: { ...layout, pocketMode: 'floor' } });
    expect(floorPlan.inlay).toBeNull();
    expect(floorPlan.area.width).toBeGreaterThan(inlayPlan.area.width);
    expect(floorPlan.strips[0].capacity).toBeGreaterThan(inlayPlan.strips[0].capacity);
  });
});

describe('project sharing', () => {
  it('round-trips through the URL encoding without preview settings', () => {
    const p = makeDefaultProject();
    p.name = 'Kill team · 2026';
    const decoded = decodeProject(encodeProject(p));
    expect(decoded.name).toBe(p.name);
    expect(decoded.groups).toEqual(p.groups);
    expect(decoded.bin).toEqual(p.bin);
  });

  it('repairs invalid input instead of failing', () => {
    expect(decodeProject('not base64!')).toBeNull();
    const repaired = normalizeProject({ groups: [{ shape: 'hexagon', count: -3, sizeX: 'x' }], bin: { lip: 'yes' } });
    expect(repaired.groups[0].shape).toBe('round');
    expect(repaired.groups[0].count).toBe(1);
    expect(repaired.bin.lip).toBe(true);
  });
});
