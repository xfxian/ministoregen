// @vitest-environment node
import Module from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_WALL, LIP_HEIGHT, LIP_TIP, buildGridfinityBin, minBodyHeight, outerSize, throatSize, unitsForInnerSize,
} from './gridfinity';

let wasm;
beforeAll(async () => {
  wasm = await Module();
  wasm.setup();
});

const H = 21; // 3 height units

function bin(opts = {}) {
  return buildGridfinityBin(wasm, { unitsX: 1, unitsY: 1, heightMm: H, segments: 24, ...opts });
}

function overlapVolume(a, b) {
  const both = a.intersect(b);
  const volume = both.volume();
  both.delete();
  return volume;
}

describe('buildGridfinityBin', () => {
  it.each([
    { unitsX: 1, unitsY: 1 },
    { unitsX: 2, unitsY: 3 },
    { unitsX: 2, unitsY: 1, lip: false },
    { unitsX: 1, unitsY: 2, feet: false },
  ])('produces a single watertight solid for %o', (opts) => {
    const m = bin(opts);
    expect(m.status()).toBe('NoError');
    expect(m.genus()).toBe(0);
    expect(m.volume()).toBeGreaterThan(0);
    m.delete();
  });

  it('matches the Gridfinity outer envelope', () => {
    const m = bin({ unitsX: 2, unitsY: 3 });
    const { min, max } = m.boundingBox();
    expect(max[0] - min[0]).toBeCloseTo(outerSize(2), 3);
    expect(max[1] - min[1]).toBeCloseTo(outerSize(3), 3);
    expect(min[2]).toBeCloseTo(0, 3);
    expect(max[2]).toBeCloseTo(H + LIP_HEIGHT - LIP_TIP, 3);
    m.delete();
  });

  it('clamps heights that leave no room below the lip', () => {
    const m = bin({ heightMm: 2 });
    const min = minBodyHeight({ feet: true, floor: 1.2, wall: DEFAULT_WALL, lip: true });
    expect(m.boundingBox().max[2]).toBeCloseTo(min + LIP_HEIGHT - LIP_TIP, 3);
    m.delete();
  });
});

describe('stacking', () => {
  // With the spec profiles, the upper bin's feet seat along both 45° chamfers of
  // the lower bin's lip, with the bottom of the feet 0.35 mm below the lip base.
  const SEATED = H - 0.35;

  it('lets an identical bin drop into the lip and rest on the chamfers', () => {
    const lower = bin();
    const upper = bin();
    const seated = upper.translate(0, 0, SEATED + 0.02);
    const tooLow = upper.translate(0, 0, SEATED - 0.15);
    expect(overlapVolume(lower, seated)).toBeLessThan(1e-3);
    expect(overlapVolume(lower, tooLow)).toBeGreaterThan(0.1);
    [lower, upper, seated, tooLow].forEach((m) => m.delete());
  });

  it('keeps a seated bin from sliding sideways', () => {
    const lower = bin({ unitsX: 2 });
    const upper = bin({ unitsX: 2 });
    const shifted = upper.translate(0.6, 0, SEATED + 0.02);
    expect(overlapVolume(lower, shifted)).toBeGreaterThan(0.1);
    [lower, upper, shifted].forEach((m) => m.delete());
  });

  it('seats a multi-unit bin on a bin of the same footprint', () => {
    const lower = bin({ unitsX: 2, unitsY: 3 });
    const upper = bin({ unitsX: 2, unitsY: 3, heightMm: 14 });
    const seated = upper.translate(0, 0, SEATED + 0.02);
    expect(overlapVolume(lower, seated)).toBeLessThan(1e-3);
    [lower, upper, seated].forEach((m) => m.delete());
  });
});

describe('sizing helpers', () => {
  it('picks the smallest bin whose lip opening fits the inner size', () => {
    expect(unitsForInnerSize(throatSize(1))).toBe(1);
    expect(unitsForInnerSize(throatSize(1) + 0.1)).toBe(2);
    expect(unitsForInnerSize(throatSize(3))).toBe(3);
    expect(unitsForInnerSize(1)).toBe(1);
  });
});
