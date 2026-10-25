// @vitest-environment node
import Module from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { planProject } from '../model/layout';
import { makeDefaultProject, makeGroup } from '../model/project';
import { buildBinPart, buildInlayPart } from './parts';

let wasm;
beforeAll(async () => {
  wasm = await Module();
  wasm.setup();
});

function project(pocketMode) {
  const p = makeDefaultProject();
  p.preview.segments = 16;
  p.layout.pocketMode = pocketMode;
  p.groups = [makeGroup(0, { count: 4 }), makeGroup(1, { shape: 'square', sizeX: 25, sizeY: 25, count: 2 })];
  return p;
}

describe('printable parts', () => {
  it('cuts floor pockets into a single watertight bin', () => {
    const p = project('floor');
    const plan = planProject(p);
    const bin = buildBinPart(wasm, p, plan);
    expect(bin.status()).toBe('NoError');
    expect(bin.genus()).toBe(0);
    const plain = buildBinPart(wasm, { ...p, layout: { ...p.layout, pocketMode: 'inlay' } }, plan);
    // Thicker floor minus pockets is still more material than the plain bin.
    expect(bin.volume()).toBeGreaterThan(plain.volume());
    [bin, plain].forEach((m) => m.delete());
  });

  it('builds an inlay with one through hole per pocket', () => {
    const p = project('inlay');
    const plan = planProject(p);
    const inlay = buildInlayPart(wasm, p, plan);
    const pockets = plan.strips.reduce((n, s) => n + s.positions.length, 0);
    expect(inlay.status()).toBe('NoError');
    expect(inlay.genus()).toBe(pockets);
    const { min, max } = inlay.boundingBox();
    expect(max[0] - min[0]).toBeCloseTo(plan.inlay.width, 3);
    expect(max[2] - min[2]).toBeCloseTo(plan.inlay.depth, 3);
    inlay.delete();
  });
});

describe('vehicle pockets', () => {
  function vehicles(pocketMode) {
    const p = makeDefaultProject();
    p.preview.segments = 16;
    p.layout.pocketMode = pocketMode;
    p.groups = [
      makeGroup(0, {
        shape: 'pads', sizeX: 60, sizeY: 90, count: 1, heightMm: 50, pocketDepth: 8,
        pads: [{ x: 0, y: 35, sizeX: 10, sizeY: 10, shape: 'round' }, { x: -20, y: -35, sizeX: 10, sizeY: 10, shape: 'round' }, { x: 20, y: -35, sizeX: 10, sizeY: 10, shape: 'rect' }],
      }),
      makeGroup(1, { count: 2, notches: true }),
    ];
    return p;
  }

  it('cuts touchpoints through a thick inlay and stops shallower pockets short of its bottom', () => {
    const p = vehicles('inlay');
    const plan = planProject(p);
    const inlay = buildInlayPart(wasm, p, plan);
    expect(inlay.status()).toBe('NoError');
    // Only the three 8 mm touchpoints go through; the 3 mm pockets are blind.
    expect(inlay.genus()).toBe(3);
    const { min, max } = inlay.boundingBox();
    expect(max[2] - min[2]).toBeCloseTo(8, 3);
    inlay.delete();
  });

  it('cuts touchpoints, notches and pockets of different depths into one watertight bin', () => {
    const p = vehicles('floor');
    const plan = planProject(p);
    const bin = buildBinPart(wasm, p, plan);
    expect(bin.status()).toBe('NoError');
    expect(bin.genus()).toBe(0);
    bin.delete();
  });
});
