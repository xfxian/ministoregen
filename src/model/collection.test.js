import { describe, expect, it } from 'vitest';
import {
  addCase, addUnit, assignRemaining, assignedCount, caseProject, clampAssignments, distribute, makeCase,
  makeDefaultCollection, makeUnit, normalizeCollection, patchUnit, removeUnit, setItemCount, unassigned,
} from './collection';
import { planProject } from './layout';

function collectionWith(units) {
  return units.reduce((c, u) => addUnit(u)(c), makeDefaultCollection());
}

const intercessors = makeUnit(0, { name: 'Intercessors', sizeX: 32, sizeY: 32, count: 6, heightMm: 38 });
const dreadnought = makeUnit(1, { name: 'Dreadnought', sizeX: 60, sizeY: 60, count: 1, heightMm: 55 });

describe('assignments', () => {
  it('limits a case to what is owned and not stored elsewhere', () => {
    let c = collectionWith([intercessors]);
    const a = makeCase(c);
    c = addCase(a)(c);
    const b = makeCase(c);
    c = addCase(b)(c);
    c = setItemCount(a.id, intercessors.id, 4)(c);
    c = setItemCount(b.id, intercessors.id, 10)(c);
    expect(c.cases[1].items).toEqual([{ unitId: intercessors.id, count: 2 }]);
    expect(unassigned(c)).toEqual([]);
  });

  it('names new cases after the highest number in use', () => {
    let c = makeDefaultCollection();
    c = addCase(makeCase(c, { name: 'Case 4' }))(c);
    expect(makeCase(c).name).toBe('Case 5');
  });

  it('moves the rest of a unit into a case', () => {
    let c = collectionWith([intercessors]);
    const a = makeCase(c);
    c = addCase(a)(c);
    c = setItemCount(a.id, intercessors.id, 2)(c);
    c = assignRemaining(a.id, intercessors.id)(c);
    expect(assignedCount(c, intercessors.id)).toBe(6);
  });

  it('gives back miniatures when a unit shrinks or is removed', () => {
    let c = collectionWith([intercessors, dreadnought]);
    const a = makeCase(c);
    const b = makeCase({ ...c, cases: [a] });
    c = addCase(b)(addCase(a)(c));
    c = setItemCount(a.id, intercessors.id, 4)(c);
    c = setItemCount(b.id, intercessors.id, 2)(c);
    c = setItemCount(b.id, dreadnought.id, 1)(c);
    c = patchUnit(intercessors.id, { count: 5 })(c);
    expect(c.cases[0].items[0].count).toBe(4);
    expect(c.cases[1].items).toEqual([{ unitId: intercessors.id, count: 1 }, { unitId: dreadnought.id, count: 1 }]);
    c = removeUnit(intercessors.id)(c);
    expect(c.cases[0].items).toEqual([]);
    expect(c.cases[1].items).toEqual([{ unitId: dreadnought.id, count: 1 }]);
  });

  it('turns a case into a project with one group per unit', () => {
    let c = collectionWith([intercessors, dreadnought]);
    const a = makeCase(c);
    c = setItemCount(a.id, dreadnought.id, 1)(setItemCount(a.id, intercessors.id, 3)(addCase(a)(c)));
    const project = caseProject(c, c.cases[0]);
    expect(project.groups.map((g) => [g.name, g.count])).toEqual([['Intercessors', 3], ['Dreadnought', 1]]);
    expect(planProject(project).warnings.filter((w) => w.severity === 'error')).toEqual([]);
  });

  it('repairs broken stored data', () => {
    const c = normalizeCollection({
      units: [{ ...intercessors }, 'junk'],
      cases: [{ name: 'A', items: [{ unitId: intercessors.id, count: 99 }, { unitId: 'missing', count: 1 }] }],
    });
    expect(c.units).toHaveLength(1);
    expect(c.cases[0].items).toEqual([{ unitId: intercessors.id, count: 6 }]);
    expect(clampAssignments(c)).toBe(c);
  });
});

describe('distribute', () => {
  const fitsAll = (c) => c.cases.every((x) => !planProject(caseProject(c, x)).warnings.some((w) => w.severity === 'error'));

  it('puts similar units into one case', () => {
    const assault = makeUnit(2, { name: 'Assault', sizeX: 32, sizeY: 32, count: 4, heightMm: 38 });
    const c = distribute(collectionWith([intercessors, assault]));
    expect(c.cases).toHaveLength(1);
    expect(unassigned(c)).toEqual([]);
    expect(fitsAll(c)).toBe(true);
  });

  it('keeps a tall model apart when sharing would waste more space', () => {
    const c = distribute(collectionWith([intercessors, dreadnought]));
    expect(unassigned(c)).toEqual([]);
    expect(fitsAll(c)).toBe(true);
  });

  it('opens more cases when one bin is not enough, and everything fits', () => {
    const horde = makeUnit(2, { name: 'Gaunts', sizeX: 25, sizeY: 25, count: 120, heightMm: 30 });
    const c = distribute(collectionWith([intercessors, dreadnought, horde]));
    expect(c.cases.length).toBeGreaterThan(1);
    expect(unassigned(c)).toEqual([]);
    expect(fitsAll(c)).toBe(true);
  });

  it('keeps units together unless they need more than one case', () => {
    const big = makeUnit(2, { name: 'Gaunts', sizeX: 25, sizeY: 25, count: 120, heightMm: 30 });
    const c = distribute(collectionWith([intercessors, big]));
    const holding = (id) => c.cases.filter((x) => x.items.some((i) => i.unitId === id)).length;
    expect(holding(intercessors.id)).toBe(1);
    expect(holding(big.id)).toBeGreaterThan(1);
  });

  it('fills an existing case before opening a new one', () => {
    let c = collectionWith([intercessors]);
    const a = makeCase(c);
    c = addCase(a)(c);
    c = distribute(c);
    expect(c.cases).toHaveLength(1);
    expect(c.cases[0].items).toEqual([{ unitId: intercessors.id, count: 6 }]);
  });

  it('leaves bases that fit no case on the shelf', () => {
    const titan = makeUnit(2, { name: 'Titan', sizeX: 250, sizeY: 250, count: 1, heightMm: 120 });
    const c = distribute(collectionWith([titan]));
    expect(unassigned(c)).toEqual([{ unit: c.units[0], count: 1 }]);
  });
});
