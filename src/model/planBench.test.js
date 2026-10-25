// Rough timing for planning (pocket layout and sorting into cases); run with
// BENCH=1 npx vitest run src/model/planBench.test.js --disableConsoleIntercept
import { describe, it } from 'vitest';
import {
  caseProject, distribute, makeDefaultCollection, makeModel, makeUnit,
} from './collection';
import { planProject } from './layout';
import { makeDefaultProject, makeGroup } from './project';

// Every run nudges the first size a little, so no run reuses what an earlier one cached,
// like a design being edited.
function time(label, run, repeat = 5) {
  const result = run(0);
  const t0 = performance.now();
  for (let i = 1; i <= repeat; i++) run(i);
  // eslint-disable-next-line no-console -- timing output is the purpose of this test
  console.log(`${label}: ${((performance.now() - t0) / repeat).toFixed(1)} ms, ${size(result)}`);
}

/** Grid cells × height units of a plan, or summed over the cases of a collection. */
function size(result) {
  if (result.unitsX) return `${result.unitsX}×${result.unitsY}×${result.heightUnits}u`;
  const plans = result.cases.map((c) => planProject(caseProject(result, c)));
  const cells = plans.reduce((n, p) => n + p.unitsX * p.unitsY, 0);
  return `${plans.length} cases, ${cells} cells`;
}

function plan(groups) {
  return (i) => {
    const p = makeDefaultProject();
    p.groups = groups.map((g, gi) => (gi === 0 ? { ...g, sizeX: g.sizeX + i * 0.1, sizeY: g.sizeY + i * 0.1 } : g));
    return planProject(p);
  };
}

const collection = (overhang, i) => ({
  ...makeDefaultCollection(),
  sortMode: 'units',
  units: [
    makeUnit(0, { name: 'Intercessors', sizeX: 32 + i * 0.1, sizeY: 32 + i * 0.1, count: 10, heightMm: 40 }),
    makeUnit(1, { name: 'Scouts', sizeX: 25, sizeY: 25, count: 10, heightMm: 30 }),
    makeUnit(2, { name: 'Bikes', shape: 'oval', sizeX: 35.5, sizeY: 60, count: 3, heightMm: 45 }),
    makeUnit(3, { name: 'Lance', models: [
      makeModel(0, { sizeX: 60, sizeY: 60, count: 2, heightMm: 80, overhang: overhang.lance }),
      makeModel(1, { sizeX: 32, sizeY: 32, count: 2, heightMm: 30 }),
    ] }),
    makeUnit(4, { name: 'Crisis', sizeX: 40, sizeY: 40, count: 3, heightMm: 55, overhang: overhang.crisis }),
    makeUnit(5, { name: 'Dreadnought', sizeX: 60, sizeY: 60, count: 1, heightMm: 70 }),
    makeUnit(6, { name: 'Terminators', sizeX: 40, sizeY: 40, count: 5, heightMm: 45 }),
  ],
});

// Three copies of every unit, with their own ids.
const tripled = (c) => ({
  ...c,
  units: [0, 1, 2].flatMap((n) => c.units.map((u) => ({ ...u, id: `${u.id}-${n}`, models: u.models.map((m) => ({ ...m, id: `${m.id}-${n}` })) }))),
});

describe.skipIf(!process.env.BENCH)('planning timing', () => {
  it('plans bins and sorts collections quickly enough', () => {
    time('5x5 infantry bin (80 pockets)', plan([makeGroup(0, { sizeX: 25, sizeY: 25, count: 60 }), makeGroup(1, { sizeX: 32, sizeY: 32, count: 20 })]));
    time('mixed case, even overhang (15 models)', plan([
      makeGroup(0, { sizeX: 60, sizeY: 60, count: 2, heightMm: 80, overhang: 15 }),
      makeGroup(1, { sizeX: 40, sizeY: 40, count: 3, overhang: 8 }),
      makeGroup(2, { sizeX: 32, sizeY: 32, count: 4 }),
      makeGroup(3, { sizeX: 25, sizeY: 25, count: 6 }),
    ]));
    time('sort collection, even overhang (7 units)', (i) => distribute(collection({ lance: 15, crisis: 8 }, i)), 3);
    time('sort large collection, even overhang (21 units)', (i) => distribute(tripled(collection({ lance: 15, crisis: 8 }, i))), 1);
    if (process.env.BENCH === 'sides') {
      time('mixed case, overhang per side (15 models)', plan([
        makeGroup(0, { sizeX: 60, sizeY: 60, count: 2, heightMm: 80, overhang: { front: 10, right: 15, back: 20 } }),
        makeGroup(1, { sizeX: 40, sizeY: 40, count: 3, overhang: { left: 8 } }),
        makeGroup(2, { sizeX: 32, sizeY: 32, count: 4 }),
        makeGroup(3, { sizeX: 25, sizeY: 25, count: 6 }),
      ]));
      time('sort large collection, overhang per side (21 units)', (i) => distribute(tripled(collection({ lance: { front: 10, right: 15, back: 20 }, crisis: { left: 8 } }, i))), 1);
      time('sort collection, overhang per side (7 units)', (i) => distribute(collection({ lance: { front: 10, right: 15, back: 20 }, crisis: { left: 8 } }, i)), 3);
    }
  }, 600000);
});
