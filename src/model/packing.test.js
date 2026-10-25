// @vitest-environment node
import Module from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { footprintCost, planProject } from './layout';
import { placeOutline, pocketOutline } from './pockets';
import { makeDefaultProject, makeGroup } from './project';

let wasm;
beforeAll(async () => {
  wasm = await Module();
  wasm.setup();
});

function project(groups, layout = {}) {
  const p = makeDefaultProject();
  return { ...p, groups, layout: { ...p.layout, ...layout } };
}

/**
 * Checks a plan geometrically: every pocket, grown by half the spacing, stays inside
 * the usable area and overlaps no other pocket.
 */
function expectValidPockets(p) {
  const plan = planProject(p);
  const { CrossSection } = wasm;
  const { spacing, margin } = p.layout;
  const halfW = plan.area.width / 2 - margin;
  const halfL = plan.area.length / 2 - margin;
  const sections = [];
  for (const strip of plan.strips) {
    const outline = pocketOutline(strip.group, p.layout, 32);
    for (const position of strip.positions) {
      const points = placeOutline(outline, position);
      for (const [x, y] of points) {
        expect(Math.abs(x)).toBeLessThanOrEqual(halfW + 1e-6);
        expect(Math.abs(y)).toBeLessThanOrEqual(halfL + 1e-6);
      }
      sections.push(CrossSection.ofPolygons([points]).offset(spacing / 2 - 0.01, 'Miter'));
    }
  }
  const separate = sections.reduce((n, s) => n + s.area(), 0);
  const union = CrossSection.union(sections);
  expect(union.area()).toBeCloseTo(separate, 3);
  [union, ...sections].forEach((s) => s.delete());
  return plan;
}

describe('packing', () => {
  it.each([
    ['one round group', [makeGroup(0, { sizeX: 32, sizeY: 32, count: 6 })]],
    ['a large base with small ones', [makeGroup(0, { sizeX: 60, sizeY: 60, count: 1 }), makeGroup(1, { sizeX: 32, sizeY: 32, count: 6 })]],
    ['ovals', [makeGroup(0, { shape: 'oval', sizeX: 42, sizeY: 75, count: 5 })]],
    ['mixed sizes', [
      makeGroup(0, { sizeX: 60, sizeY: 60, count: 2 }),
      makeGroup(1, { sizeX: 40, sizeY: 40, count: 3 }),
      makeGroup(2, { sizeX: 25, sizeY: 25, count: 10 }),
    ]],
    ['rectangles and ovals', [
      makeGroup(0, { shape: 'rect', sizeX: 25, sizeY: 50, count: 4 }),
      makeGroup(1, { shape: 'oval', sizeX: 35.5, sizeY: 60, count: 3 }),
      makeGroup(2, { shape: 'square', sizeX: 20, sizeY: 20, count: 7 }),
    ]],
  ])('keeps every pocket inside the area and apart: %s', (_, groups) => {
    for (const pocketMode of ['inlay', 'floor']) {
      const plan = expectValidPockets(project(groups, { pocketMode }));
      expect(plan.warnings.filter((w) => w.severity === 'error')).toEqual([]);
      plan.strips.forEach((s) => expect(s.capacity).toBeGreaterThanOrEqual(s.group.count));
    }
  });

  it('turns oval bases when that needs a smaller bin', () => {
    const plan = expectValidPockets(project([makeGroup(0, { shape: 'oval', sizeX: 42, sizeY: 75, count: 5 })]));
    expect(plan.unitsX * plan.unitsY).toBeLessThanOrEqual(12);
    expect(plan.strips[0].positions.some(([, , rotated]) => rotated)).toBe(true);
  });

  it('fills the room next to a large base with smaller ones', () => {
    // A 40 mm base sits next to the 60 mm one, so 3 × 3 is enough; one group per strip needs 3 × 4.
    const plan = expectValidPockets(project([
      makeGroup(0, { sizeX: 60, sizeY: 60, count: 1 }),
      makeGroup(1, { sizeX: 40, sizeY: 40, count: 3 }),
    ]));
    expect(plan.unitsX * plan.unitsY).toBeLessThanOrEqual(9);
    const [[, bigY]] = plan.strips[0].positions;
    expect(plan.strips[1].positions.some(([, y]) => Math.abs(y - bigY) < 10)).toBe(true);
  });

  it('prefers a compact bin over a long thin one', () => {
    expect(footprintCost(1, 5)).toBeGreaterThan(footprintCost(2, 3));
    expect(footprintCost(2, 2)).toBe(4);
    const plan = planProject(project([makeGroup(0, { sizeX: 32, sizeY: 32, count: 6 })]));
    expect(Math.max(plan.unitsX, plan.unitsY) / Math.min(plan.unitsX, plan.unitsY)).toBeLessThanOrEqual(2);
  });

  it('lists the pockets a group needs before its spares', () => {
    const plan = planProject(project([makeGroup(0, { sizeX: 60, sizeY: 60, count: 1 }), makeGroup(1, { sizeX: 25, sizeY: 25, count: 3 })]));
    for (const s of plan.strips) expect(s.positions.length).toBe(s.capacity);
  });
});
