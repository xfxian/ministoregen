// @vitest-environment node
import Module from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { manifoldToStl } from '../export';
import { buildGridfinityBin, outerSize } from './gridfinity';
import { LID_SEAT_DROP, LID_SNAP_DROP, buildLid, buildSnapGrooves, lidHeight } from './lid';
import { inspectStl } from './meshCheck';

let wasm;
beforeAll(async () => {
  wasm = await Module();
  wasm.setup();
});

const H = 21;
// A bin as the app builds it for a lid: with grooves in the wall when the lid has snap clips.
function bin({ snap = false, ...opts } = {}) {
  const shell = buildGridfinityBin(wasm, { unitsX: 2, unitsY: 1, heightMm: H, segments: 24, ...opts });
  if (!snap) return shell;
  const grooves = buildSnapGrooves(wasm, { unitsX: 2, unitsY: 1, heightMm: H });
  const result = shell.subtract(grooves);
  [shell, grooves].forEach((m) => m.delete());
  return result;
}
const lid = (opts) => buildLid(wasm, { unitsX: 2, unitsY: 1, segments: 24, ...opts });

function overlap(a, b) {
  const both = a.intersect(b);
  const v = both.volume();
  both.delete();
  return v;
}

const VARIANTS = [
  { style: 'flat', snap: false },
  { style: 'flat', snap: true },
  { style: 'stackable', snap: false },
  { style: 'stackable', snap: true },
];

describe('lids', () => {
  it.each(VARIANTS)('is one closed solid with the bin footprint: %o', (opts) => {
    for (const [unitsX, unitsY] of [[1, 1], [2, 1], [3, 4]]) {
      const m = buildLid(wasm, { unitsX, unitsY, segments: 24, ...opts });
      const report = inspectStl(manifoldToStl(m));
      expect(report.problems).toEqual([]);
      expect(report.bodies).toBe(1);
      expect(report.genus).toBe(0);
      expect(report.max[0] - report.min[0]).toBeCloseTo(outerSize(unitsX), 2);
      expect(report.max[1] - report.min[1]).toBeCloseTo(outerSize(unitsY), 2);
      expect(report.min[2]).toBeCloseTo(0, 3);
      expect(report.max[2]).toBeCloseTo(lidHeight(opts), 2);
      m.delete();
    }
  });

  it.each([
    ...VARIANTS.map((v) => ({ ...v, wall: 2.6 })),
    { style: 'flat', snap: true, wall: 0.95 },
    { style: 'flat', snap: true, wall: 1.9 },
  ])('seats in the lip without touching the bin and cannot slide: %o', ({ wall, ...opts }) => {
    const b = bin({ wall, snap: opts.snap });
    const l = lid(opts);
    const seat = H - (opts.snap ? LID_SNAP_DROP : LID_SEAT_DROP);
    const seated = l.translate(0, 0, seat + 0.02);
    const tooLow = l.translate(0, 0, seat - 0.15);
    const shifted = l.translate(0.6, 0, seat + 0.02);
    expect(overlap(b, seated)).toBeLessThan(1e-3);
    expect(overlap(b, tooLow)).toBeGreaterThan(0.05);
    expect(overlap(b, shifted)).toBeGreaterThan(0.05);
    [b, l, seated, tooLow, shifted].forEach((m) => m.delete());
  });

  it.each([2.6, 1.9, 0.95])('snap clips catch when the lid is pulled up (wall %s)', (wall) => {
    for (const style of ['flat', 'stackable']) {
      const b = bin({ wall, snap: true });
      const plain = lid({ style, snap: false });
      const clipped = lid({ style, snap: true });
      const lifted = (m, drop) => m.translate(0, 0, H - drop + 0.4);
      const a = lifted(plain, LID_SEAT_DROP);
      const c = lifted(clipped, LID_SNAP_DROP);
      // Without clips a lid lifts freely; with clips the barbs run into the groove roof
      // (or the lip support of a thin wall).
      expect(overlap(b, a)).toBeLessThan(1e-3);
      expect(overlap(b, c)).toBeGreaterThan(0.05);
      [b, plain, clipped, a, c].forEach((m) => m.delete());
    }
  });

  it('snap clips are springs that hang free of the lid except at their root', () => {
    const plain = lid({ style: 'flat', snap: false });
    const clipped = lid({ style: 'flat', snap: true });
    // A thin probe in the slot behind each beam finds no material: the beam can flex inwards.
    // The +X beam runs from its root at y = -13.5 to its free end at y = 2.5.
    const probe = wasm.Manifold.cube([0.3, 12, 2.5]).translate(outerSize(2) / 2 - 4.95, -9, 0.2);
    expect(overlap(clipped, probe)).toBeLessThan(1e-6);
    expect(overlap(plain, probe)).toBeGreaterThan(1);
    // A gap above the beam separates it from the lid body.
    const roof = wasm.Manifold.cube([1, 12, 0.6]).translate(outerSize(2) / 2 - 4, -9, 3.1);
    expect(overlap(clipped, roof)).toBeLessThan(1e-6);
    [plain, clipped, probe, roof].forEach((m) => m.delete());
  });

  it.each([false, true])('takes a bin on top of a stackable lid (snap %s)', (snap) => {
    const l = lid({ style: 'stackable', snap });
    // Two 1 × 1 bins and one 2 × 1 bin seat on the receptacles like on a baseplate.
    for (const [unitsX, xs] of [[1, [-21, 21]], [2, [0]]]) {
      const top = buildGridfinityBin(wasm, { unitsX, unitsY: 1, heightMm: 14, segments: 24 });
      for (const x of xs) {
        const height = lidHeight({ style: 'stackable', snap });
        let seat = null;
        // Find the lowest height where the bin no longer collides with the lid.
        for (let z = height; z > height - 6; z -= 0.05) {
          const placed = top.translate(x, 0, z);
          const v = overlap(l, placed);
          placed.delete();
          if (v > 1e-3) break;
          seat = z;
        }
        expect(seat).not.toBeNull();
        // Feet sink most of their height into the receptacles.
        expect(height - seat).toBeGreaterThan(3);
        const shifted = top.translate(x + 0.8, 0, seat);
        expect(overlap(l, shifted)).toBeGreaterThan(0.05);
        shifted.delete();
      }
      top.delete();
    }
    l.delete();
  });
});
