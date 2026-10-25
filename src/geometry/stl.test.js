// @vitest-environment node
import Module from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildPrintFiles, manifoldToStl } from '../export';
import { addUnit, caseProject, distribute, makeDefaultCollection, makeUnit } from '../model/collection';
import { planProject } from '../model/layout';
import { placeOutline, pocketOutline } from '../model/pockets';
import { makeDefaultProject, makeGroup } from '../model/project';
import { FOOT_HEIGHT, LIP_HEIGHT, LIP_TIP, outerSize } from './gridfinity';
import { inspectStl } from './meshCheck';
import { buildBinPart, buildInlayPart } from './parts';

let wasm;
beforeAll(async () => {
  wasm = await Module();
  wasm.setup();
});

const GROUPS = [
  makeGroup(0, { sizeX: 32, sizeY: 32, count: 5 }),
  makeGroup(1, { shape: 'oval', sizeX: 42, sizeY: 75, count: 2 }),
  makeGroup(2, { shape: 'rect', sizeX: 25, sizeY: 50, count: 2 }),
  makeGroup(3, { shape: 'square', sizeX: 20, sizeY: 20, count: 3 }),
];

function project({ pocketMode = 'inlay', lip = true, feet = true, segments = 24 } = {}) {
  const p = makeDefaultProject();
  return {
    ...p,
    groups: GROUPS,
    bin: { ...p.bin, lip, feet },
    layout: { ...p.layout, pocketMode },
    preview: { ...p.preview, segments },
  };
}

function check(manifold) {
  const report = inspectStl(manifoldToStl(manifold));
  expect(report.problems).toEqual([]);
  expect(report.bodies).toBe(1);
  expect(report.volume).toBeCloseTo(manifold.volume(), 0);
  return report;
}

describe('exported meshes', () => {
  it.each([
    { pocketMode: 'inlay' },
    { pocketMode: 'floor' },
    { pocketMode: 'inlay', lip: false },
    { pocketMode: 'floor', feet: false },
    { pocketMode: 'floor', lip: false, feet: false },
  ])('the bin is a closed solid with the Gridfinity envelope: %o', (opts) => {
    const p = project(opts);
    const plan = planProject(p);
    const bin = buildBinPart(wasm, p, plan);
    const report = check(bin);
    // Floor pockets are blind holes, so the bin stays one piece without through holes.
    expect(report.genus).toBe(0);
    expect(report.max[0] - report.min[0]).toBeCloseTo(outerSize(plan.unitsX), 2);
    expect(report.max[1] - report.min[1]).toBeCloseTo(outerSize(plan.unitsY), 2);
    expect(report.min[2]).toBeCloseTo(0, 3);
    const top = plan.heightMm + (p.bin.lip ? LIP_HEIGHT - LIP_TIP : 0);
    expect(report.max[2]).toBeCloseTo(top, 2);
    bin.delete();
  });

  it('the inlay is a closed plate with one hole per pocket that fits inside the bin', () => {
    const p = project();
    const plan = planProject(p);
    const inlay = buildInlayPart(wasm, p, plan);
    const report = check(inlay);
    const pockets = plan.strips.reduce((n, s) => n + s.positions.length, 0);
    expect(report.genus).toBe(pockets);
    expect(report.min[2]).toBeCloseTo(0, 3);
    expect(report.max[2]).toBeCloseTo(plan.inlay.depth, 3);
    // Placed on the cavity floor, it touches the bin nowhere.
    const bin = buildBinPart(wasm, p, plan);
    const placed = inlay.translate(0, 0, plan.floorZ + 0.01);
    const overlap = bin.intersect(placed);
    expect(overlap.volume()).toBeLessThan(1e-3);
    [bin, inlay, placed, overlap].forEach((m) => m.delete());
  });

  it('floor pockets remove exactly their own volume and stay above the feet', () => {
    const p = project({ pocketMode: 'floor' });
    const plan = planProject(p);
    const withPockets = buildBinPart(wasm, p, plan);
    const solidFloor = buildBinPart(wasm, p, { ...plan, strips: [] });
    const { CrossSection } = wasm;
    let area = 0;
    for (const strip of plan.strips) {
      const outline = pocketOutline(strip.group, p.layout, p.preview.segments * 2);
      for (const position of strip.positions) {
        const s = CrossSection.ofPolygons([placeOutline(outline, position)]);
        area += s.area();
        s.delete();
      }
    }
    expect(solidFloor.volume() - withPockets.volume()).toBeCloseTo(area * p.layout.pocketDepth, 0);
    expect(plan.floorZ).toBeGreaterThanOrEqual(FOOT_HEIGHT + p.bin.floor - 1e-9);
    [withPockets, solidFloor].forEach((m) => m.delete());
  });

  it('every file of a sorted collection passes at export resolution', () => {
    let c = makeDefaultCollection();
    for (const u of [
      makeUnit(0, { sizeX: 32, sizeY: 32, count: 6, heightMm: 38 }),
      makeUnit(1, { sizeX: 60, sizeY: 60, count: 1, heightMm: 55 }),
      makeUnit(2, { shape: 'oval', sizeX: 42, sizeY: 75, count: 3, heightMm: 50 }),
    ]) c = addUnit(u)(c);
    c = distribute(c);
    for (const [n, item] of c.cases.entries()) {
      const base = caseProject(c, item);
      // Cover every lid variant across the cases.
      const p = { ...base, bin: { ...base.bin, lid: ['flat', 'stackable'][n % 2], lidSnap: n % 3 !== 1 } };
      for (const file of buildPrintFiles(wasm, p, planProject(p), 'case')) {
        const report = inspectStl(file.data);
        expect(report.problems, file.name).toEqual([]);
        expect(report.bodies, file.name).toBe(1);
      }
    }
  });
});

describe('inspectStl', () => {
  it('reports open and flipped surfaces', () => {
    const cube = wasm.Manifold.cube([10, 10, 10]);
    const stl = manifoldToStl(cube);
    cube.delete();
    expect(inspectStl(stl).problems).toEqual([]);
    expect(inspectStl(stl).genus).toBe(0);
    expect(inspectStl(stl).volume).toBeCloseTo(1000, 3);
    // Drop the last triangle: the surface is no longer closed.
    const open = new Uint8Array(stl.slice(0, stl.length - 50));
    new DataView(open.buffer).setUint32(80, 11, true);
    expect(inspectStl(open).problems.join()).toMatch(/open/);
    // Swap two corners of every triangle: the surface points inwards.
    const flipped = new Uint8Array(stl);
    for (let t = 0; t < 12; t++) {
      const o = 84 + 50 * t;
      const b = flipped.slice(o + 24, o + 36);
      flipped.copyWithin(o + 24, o + 36, o + 48);
      flipped.set(b, o + 36);
    }
    expect(inspectStl(flipped).problems.join()).toMatch(/inwards/);
  });
});
