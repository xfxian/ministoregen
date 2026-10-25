import { describe, expect, it } from 'vitest';
import { planProject } from './layout';
import { NEST_LIMIT, nestGroups } from './nest';
import { placeOutline } from './pockets';
import { DEFAULT_LAYOUT, makeDefaultProject, makeGroup } from './project';
import {
  distinctTurns, lattices, normalizeOverhang, reachBox, reachOutline, turnGroup,
} from './reach';

const layout = DEFAULT_LAYOUT;
const sides = (front, right, back, left) => ({ front, right, back, left });

describe('overhang per side', () => {
  it('reads one number as the same overhang on every side and repairs bad values', () => {
    expect(normalizeOverhang(12)).toEqual(sides(12, 12, 12, 12));
    expect(normalizeOverhang({ right: 15 })).toEqual(sides(0, 15, 0, 0));
    expect(normalizeOverhang({ front: -1, right: Infinity, back: 300, left: '4' })).toEqual(sides(0, 0, 100, 0));
    expect(normalizeOverhang(null)).toEqual(sides(0, 0, 0, 0));
  });

  it('reaches as far as given towards each side', () => {
    const gun = makeGroup(0, { sizeX: 32, sizeY: 32, overhang: { right: 15 } });
    const r = 16 + layout.baseClearance / 2;
    expect(reachBox(gun, layout)).toEqual({ x0: -r, x1: r + 15, y0: -r, y1: r });
    const xs = reachOutline(gun, layout).map(([x]) => x);
    expect(Math.max(...xs)).toBeCloseTo(r + 15, 6);
    expect(Math.min(...xs)).toBeCloseTo(-r, 6);
  });

  it('turns the overhang with the pocket', () => {
    const model = makeGroup(0, { shape: 'oval', sizeX: 35.5, sizeY: 60, overhang: { front: 12, right: 4 } });
    for (const turns of [1, 2, 3]) {
      const turnedOutline = placeOutline(reachOutline(model, layout, 32), [0, 0, turns]);
      const outlineOfTurned = reachOutline(turnGroup(model, turns), layout, 32);
      const box = (pts) => [0, 1].flatMap((i) => [Math.min(...pts.map((p) => p[i])), Math.max(...pts.map((p) => p[i]))]);
      box(turnedOutline).forEach((v, i) => expect(v).toBeCloseTo(box(outlineOfTurned)[i], 6));
    }
  });

  it('only tries the turns that change the footprint', () => {
    expect(distinctTurns(makeGroup(0, { sizeX: 32, sizeY: 32 }))).toEqual([0]);
    expect(distinctTurns(makeGroup(0, { sizeX: 32, sizeY: 32, overhang: 5 }))).toEqual([0]);
    expect(distinctTurns(makeGroup(0, { shape: 'oval', sizeX: 25, sizeY: 50 }))).toEqual([0, 1]);
    expect(distinctTurns(makeGroup(0, { sizeX: 32, sizeY: 32, overhang: { right: 10 } }))).toEqual([0, 1, 2, 3]);
  });
});

describe('lattices', () => {
  it('packs plain round bases in the usual hex pattern', () => {
    const [hex] = lattices(makeGroup(0, { sizeX: 32, sizeY: 32 }), layout);
    const pitch = 32 + layout.baseClearance + layout.spacing;
    expect(hex.colStep).toBeCloseTo(pitch, 6);
    expect(hex.shift).toBeCloseTo(pitch / 2, 6);
    expect(hex.rowStep).toBeCloseTo((pitch * Math.sqrt(3)) / 2, 6);
  });

  it('lets round ends nest when the overhang is on one side', () => {
    const d = 32 + layout.baseClearance;
    const [best] = lattices(makeGroup(0, { sizeX: 32, sizeY: 32, overhang: { right: 15 } }), layout);
    expect(best.colStep).toBeCloseTo(d + 15 + layout.spacing, 6);
    // Shifted rows sit closer than a full base apart, but never closer than the bases allow.
    expect(best.rowStep).toBeLessThan(d + layout.spacing - 1);
    const offset = Math.min(best.shift, best.colStep - best.shift);
    expect(Math.hypot(Math.max(0, offset - 15), best.rowStep)).toBeGreaterThanOrEqual(d + layout.spacing - 1e-6);
    // A third of the room the same overhang on every side takes.
    const [even] = lattices(makeGroup(0, { sizeX: 32, sizeY: 32, overhang: 15 }), layout);
    expect(best.colStep * best.rowStep).toBeLessThan(0.5 * even.colStep * even.rowStep);
  });
});

describe('free placement', () => {
  it('leaves large cases to the shelf packer', () => {
    const many = [makeGroup(0, { sizeX: 25, sizeY: 25, count: NEST_LIMIT }), makeGroup(1, { sizeX: 32, sizeY: 32, count: 1 })];
    expect(nestGroups(many, layout, 500, 500)).toBeNull();
  });

  it('reports when the models do not all fit', () => {
    expect(nestGroups([makeGroup(0, { sizeX: 60, sizeY: 60, count: 2 })], layout, 100, 60)).toBeNull();
  });

  it('plans a mixed case quickly enough for live editing', () => {
    const p = makeDefaultProject();
    p.groups = [
      makeGroup(0, { sizeX: 60, sizeY: 60, count: 2, heightMm: 80, overhang: { front: 10, right: 15, back: 20 } }),
      makeGroup(1, { sizeX: 40, sizeY: 40, count: 3, overhang: { left: 8 } }),
      makeGroup(2, { sizeX: 32, sizeY: 32, count: 4 }),
      makeGroup(3, { sizeX: 25, sizeY: 25, count: 6 }),
    ];
    const t0 = performance.now();
    const plan = planProject(p);
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(plan.warnings.filter((w) => w.severity === 'error')).toEqual([]);
  });
});
