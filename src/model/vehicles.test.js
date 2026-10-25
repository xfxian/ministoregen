import { describe, expect, it } from 'vitest';
import { planProject, pocketDepthOf } from './layout';
import {
  NOTCH_RADIUS, NOTCH_REACH, clampPad, cutOutlines, notchOutlines, padLayout, placeOutline,
} from './pockets';
import { makeDefaultProject, makeGroup, normalizeGroup } from './project';
import { distinctTurns, reachBox, shapeSupports, turnGroup } from './reach';

const layout = makeDefaultProject().layout;

function project(groups, layoutPatch = {}) {
  const p = makeDefaultProject();
  return { ...p, groups, layout: { ...p.layout, ...layoutPatch } };
}

describe('pocket depth per model', () => {
  it('uses the bin depth unless the model has its own', () => {
    expect(pocketDepthOf(makeGroup(0), { ...layout, pocketMode: 'floor', pocketDepth: 4 })).toBe(4);
    expect(pocketDepthOf(makeGroup(0), { ...layout, pocketMode: 'inlay', inlayDepth: 2 })).toBe(2);
    expect(pocketDepthOf(makeGroup(0, { pocketDepth: 9 }), layout)).toBe(9);
  });

  it('makes the floor as thick as the deepest pocket and seats shallower models higher', () => {
    const tank = makeGroup(0, { shape: 'rect', sizeX: 60, sizeY: 100, count: 1, heightMm: 60, pocketDepth: 10 });
    const troops = makeGroup(1, { count: 4, heightMm: 30 });
    for (const pocketMode of ['floor', 'inlay']) {
      const plan = planProject(project([tank, troops], { pocketMode }));
      expect(plan.pocketDepth).toBe(10);
      const [t, s] = plan.strips;
      expect(t.seatZ).toBeCloseTo(plan.floorZ, 9);
      expect(s.seatZ).toBeCloseTo(plan.floorZ + 10 - 3, 9);
      if (pocketMode === 'inlay') expect(plan.inlay.depth).toBe(10);
    }
  });

  it('sizes the bin height from where each model stands', () => {
    const tall = makeGroup(0, { count: 2, heightMm: 40 });
    const deep = planProject(project([tall, makeGroup(1, { count: 1, heightMm: 10, pocketDepth: 20 })]));
    const alone = planProject(project([tall]));
    // The tall models now stand 17 mm higher on the thick floor.
    expect(deep.strips[0].seatZ - alone.strips[0].seatZ).toBeCloseTo(17, 9);
    expect(deep.heightMm).toBeGreaterThan(alone.heightMm);
    expect(deep.warnings.filter((w) => w.id.startsWith('tall-'))).toEqual([]);
  });

  it('keeps a stored depth within limits and reads a missing one as the bin depth', () => {
    expect(normalizeGroup({ pocketDepth: 500 }, 0).pocketDepth).toBe(40);
    expect(normalizeGroup({ pocketDepth: 'deep' }, 0).pocketDepth).toBeNull();
    expect(normalizeGroup({}, 0).pocketDepth).toBeNull();
  });
});

describe('models without a base', () => {
  const devilfish = makeGroup(0, {
    shape: 'pads', sizeX: 70, sizeY: 110, count: 1, heightMm: 55, pads: padLayout('three', 70, 110),
  });

  it('cuts one pocket per touchpoint, all inside the footprint', () => {
    const outlines = cutOutlines(devilfish, layout, 32);
    expect(outlines).toHaveLength(3);
    for (const o of outlines) {
      for (const [x, y] of o) {
        expect(Math.abs(x)).toBeLessThanOrEqual((70 + layout.baseClearance) / 2 + 1e-9);
        expect(Math.abs(y)).toBeLessThanOrEqual((110 + layout.baseClearance) / 2 + 1e-9);
      }
    }
  });

  it('starts with tracks along the length, and keeps edited touchpoints inside', () => {
    const tracks = padLayout('tracks', 60, 100);
    expect(tracks).toHaveLength(2);
    expect(tracks.every((p) => p.sizeY > p.sizeX)).toBe(true);
    expect(clampPad({ x: 100, y: -100, sizeX: 10, sizeY: 10 }, 60, 100)).toMatchObject({ x: 25, y: -45, shape: 'round' });
    expect(normalizeGroup({ shape: 'pads', sizeX: 60, sizeY: 100 }, 0).pads).toHaveLength(2);
  });

  it('packs the whole footprint, so neighbours never stand under the hull', () => {
    const plan = planProject(project([{ ...devilfish, count: 2 }, makeGroup(1, { count: 6 })]));
    expect(plan.warnings.filter((w) => w.severity === 'error')).toEqual([]);
    const [fish, troops] = plan.strips;
    const half = [(70 + layout.baseClearance) / 2, (110 + layout.baseClearance) / 2];
    for (const [fx, fy, turns] of fish.positions.slice(0, 2)) {
      const [hx, hy] = turns % 2 ? [half[1], half[0]] : half;
      for (const [x, y] of troops.positions) {
        const r = (32 + layout.baseClearance) / 2;
        const outside = Math.abs(x - fx) >= hx + r - 1e-6 || Math.abs(y - fy) >= hy + r - 1e-6;
        expect(outside).toBe(true);
      }
    }
  });
});

describe('finger notches', () => {
  it('sit on the long sides and need room past the pocket', () => {
    const rect = makeGroup(0, { shape: 'rect', sizeX: 50, sizeY: 100, notches: true });
    const box = reachBox(rect, layout);
    expect(box.x1).toBeCloseTo((50 + layout.baseClearance) / 2 + NOTCH_REACH, 9);
    expect(box.y1).toBeCloseTo((100 + layout.baseClearance) / 2, 9);
    expect(notchOutlines(rect, layout)).toHaveLength(2);
    expect(notchOutlines({ ...rect, notches: false }, layout)).toHaveLength(0);
    const { pocket } = shapeSupports(rect, layout);
    expect(pocket[0]).toBeCloseTo((50 + layout.baseClearance) / 2 - 2 + NOTCH_RADIUS, 9);
  });

  it('turn with a round base, so packing and the cut agree', () => {
    const round = makeGroup(0, { notches: true });
    expect(distinctTurns(round)).toEqual([0, 1]);
    const turned = turnGroup(round, 1);
    const [[x, y]] = notchOutlines(turned, layout).map((o) => o.reduce(([a, b], [px, py]) => [a + px / o.length, b + py / o.length], [0, 0]));
    // Placed with one quarter turn, the cut notch sits where the turned group expects it.
    const placed = placeOutline(notchOutlines(round, layout)[0], [0, 0, 1]);
    const centre = placed.reduce(([a, b], [px, py]) => [a + px / placed.length, b + py / placed.length], [0, 0]);
    expect(Math.abs(x)).toBeCloseTo(0, 6);
    expect(Math.abs(centre[0])).toBeCloseTo(0, 6);
    expect(Math.abs(y)).toBeCloseTo(Math.abs(centre[1]), 6);
  });

  it('keep notched models apart in a plan', () => {
    const plan = planProject(project([makeGroup(0, { count: 6, notches: true })]));
    const plain = planProject(project([makeGroup(0, { count: 6 })]));
    expect(plan.warnings.filter((w) => w.severity === 'error')).toEqual([]);
    expect(plan.unitsX * plan.unitsY).toBeGreaterThanOrEqual(plain.unitsX * plain.unitsY);
  });
});
