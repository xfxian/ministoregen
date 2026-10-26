import { describe, expect, it } from 'vitest';
import {
  COLLECTION_VERSION, addCase, addCollection, addUnit, assignRemaining, assignedCount, caseProject, clampAssignments, distribute, makeCase,
  makeDefaultCollection, makeModel, makeUnit, normalizeCollection, patchUnit, removeUnit, setItemCount, unassigned,
  waitingUnits,
} from './collection';
import { planProject } from './layout';
import { NO_OVERHANG } from './reach';

function collectionWith(units, sortMode = 'units') {
  return units.reduce((c, u) => addUnit(u)(c), { ...makeDefaultCollection(), sortMode });
}

const only = (unit) => unit.models[0].id;
const intercessors = makeUnit(0, { name: 'Intercessors', sizeX: 32, sizeY: 32, count: 6, heightMm: 38 });
const dreadnought = makeUnit(1, { name: 'Dreadnought', sizeX: 60, sizeY: 60, count: 1, heightMm: 55 });
// A unit made of different models: two battlesuits on big bases that reach past them, and four drones.
const lance = makeUnit(2, {
  name: 'Twin Lance',
  models: [
    makeModel(2, { name: 'Battlesuit', sizeX: 60, sizeY: 60, count: 2, heightMm: 80, overhang: 12 }),
    makeModel(3, { name: 'Drone', sizeX: 25, sizeY: 25, count: 4, heightMm: 20 }),
  ],
});

const holding = (c, unitId, modelId) => c.cases.filter((x) => x.items.some(
  (i) => i.unitId === unitId && (modelId === undefined || i.modelId === modelId),
));
const fitsAll = (c) => c.cases.every((x) => !planProject(caseProject(c, x)).warnings.some((w) => w.severity === 'error'));

describe('assignments', () => {
  it('limits a case to what is owned and not stored elsewhere', () => {
    let c = collectionWith([intercessors]);
    const a = makeCase(c);
    c = addCase(a)(c);
    const b = makeCase(c);
    c = addCase(b)(c);
    c = setItemCount(a.id, intercessors.id, only(intercessors), 4)(c);
    c = setItemCount(b.id, intercessors.id, only(intercessors), 10)(c);
    expect(c.cases[1].items).toEqual([{ unitId: intercessors.id, modelId: only(intercessors), count: 2 }]);
    expect(unassigned(c)).toEqual([]);
  });

  it('names new cases after the highest number in use', () => {
    let c = makeDefaultCollection();
    c = addCase(makeCase(c, { name: 'Case 4' }))(c);
    expect(makeCase(c).name).toBe('Case 5');
  });

  it('moves the rest of a unit into a case, with all its models', () => {
    let c = collectionWith([intercessors, lance]);
    const a = makeCase(c);
    c = addCase(a)(c);
    c = setItemCount(a.id, intercessors.id, only(intercessors), 2)(c);
    c = assignRemaining(a.id, intercessors.id)(c);
    expect(assignedCount(c, intercessors.id)).toBe(6);
    c = assignRemaining(a.id, lance.id, lance.models[1].id)(c);
    expect(assignedCount(c, lance.id)).toBe(4);
    expect(waitingUnits(c).map((w) => [w.unit.name, w.count])).toEqual([['Twin Lance', 2]]);
    c = assignRemaining(a.id, lance.id)(c);
    expect(assignedCount(c, lance.id)).toBe(6);
  });

  it('gives back miniatures when a model shrinks or a unit is removed', () => {
    let c = collectionWith([intercessors, dreadnought]);
    const a = makeCase(c);
    const b = makeCase({ ...c, cases: [a] });
    c = addCase(b)(addCase(a)(c));
    c = setItemCount(a.id, intercessors.id, only(intercessors), 4)(c);
    c = setItemCount(b.id, intercessors.id, only(intercessors), 2)(c);
    c = setItemCount(b.id, dreadnought.id, only(dreadnought), 1)(c);
    c = patchUnit(intercessors.id, { models: [{ ...intercessors.models[0], count: 5 }] })(c);
    expect(c.cases[0].items[0].count).toBe(4);
    expect(c.cases[1].items.map((i) => i.count)).toEqual([1, 1]);
    c = removeUnit(intercessors.id)(c);
    expect(c.cases[0].items).toEqual([]);
    expect(c.cases[1].items).toEqual([{ unitId: dreadnought.id, modelId: only(dreadnought), count: 1 }]);
  });

  it('turns a case into a project with one group per model', () => {
    let c = collectionWith([intercessors, lance]);
    const a = makeCase(c);
    c = assignRemaining(a.id, lance.id)(setItemCount(a.id, intercessors.id, only(intercessors), 3)(addCase(a)(c)));
    const project = caseProject(c, c.cases[0]);
    expect(project.groups.map((g) => [g.name, g.count])).toEqual([
      ['Intercessors', 3], ['Twin Lance · Battlesuit', 2], ['Twin Lance · Drone', 4],
    ]);
    expect(project.groups[1].overhang).toBe(12);
    expect(new Set(project.groups.map((g) => g.id)).size).toBe(3);
    expect(planProject(project).warnings.filter((w) => w.severity === 'error')).toEqual([]);
  });

  it('adds another collection with new ids, keeping its cases filled', () => {
    const mine = distribute(collectionWith([makeUnit(0, { name: 'Mine', count: 3 })]));
    const theirs = distribute(collectionWith([makeUnit(0, { name: 'Theirs', count: 4 })]));
    const added = addCollection(mine, theirs);
    expect(added.units.map((u) => u.name)).toEqual(['Mine', 'Theirs']);
    expect(added.cases).toHaveLength(2);
    expect(added.units[1].id).not.toBe(theirs.units[0].id);
    expect(assignedCount(added, added.units[1].id, undefined, added.cases[0].id)).toBe(4);
    expect(unassigned(added)).toEqual([]);
  });

  it('repairs broken stored data', () => {
    const c = normalizeCollection({
      version: 3,
      units: [{ ...intercessors }, 'junk', { id: 'empty', name: 'No models', models: [] }],
      cases: [{ name: 'A', items: [{ unitId: intercessors.id, modelId: only(intercessors), count: 99 }, { unitId: 'missing', modelId: 'x', count: 1 }] }],
      sortMode: 'nonsense',
    });
    expect(c.units).toHaveLength(2);
    expect(c.units[1].models).toHaveLength(1);
    expect(c.cases[0].items).toEqual([{ unitId: intercessors.id, modelId: only(intercessors), count: 6 }]);
    expect(c.sortMode).toBe('units');
    expect(clampAssignments(c)).toBe(c);
  });

  it('upgrades collections saved before units could hold several models', () => {
    const v1 = {
      version: 1,
      name: 'Old',
      keepTogether: false,
      units: [{ id: 'u1', name: 'Crisis', shape: 'round', sizeX: 40, sizeY: 40, count: 3, heightMm: 50, color: '#ffc861' }],
      cases: [{ id: 'c1', name: 'Case 1', items: [{ unitId: 'u1', count: 2 }] }],
    };
    const c = normalizeCollection(v1);
    expect(c.version).toBe(COLLECTION_VERSION);
    expect(c.sortMode).toBe('fill');
    expect(c.units[0]).toMatchObject({ id: 'u1', name: 'Crisis' });
    expect(c.units[0].models).toEqual([expect.objectContaining({ sizeX: 40, count: 3, heightMm: 50, color: '#ffc861', overhang: NO_OVERHANG })]);
    expect(c.cases[0].items).toEqual([{ unitId: 'u1', modelId: c.units[0].models[0].id, count: 2 }]);
    expect(normalizeCollection({ ...v1, keepTogether: true }).sortMode).toBe('units');
    // Version 2 only changed the default wall; its units still hold one base each.
    expect(normalizeCollection({ ...v1, version: 2 }).cases[0].items[0].modelId).toBe(c.units[0].models[0].id);
    expect(normalizeCollection(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });

  it('turns the overhang of collections from version 3 into the same overhang on every side', () => {
    const v3 = {
      version: 3,
      units: [{ id: 'u1', name: 'Lance', models: [{ id: 'm1', name: '', shape: 'round', sizeX: 60, sizeY: 60, count: 2, heightMm: 80, overhang: 12 }] }],
      cases: [],
    };
    const c = normalizeCollection(v3);
    expect(c.version).toBe(4);
    expect(c.units[0].models[0].overhang).toEqual({ front: 12, right: 12, back: 12, left: 12 });
    expect(normalizeCollection(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });
});

describe('distribute', () => {
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
    expect(holding(c, intercessors.id)).toHaveLength(1);
    expect(holding(c, big.id).length).toBeGreaterThan(1);
  });

  it('fills an existing case before opening a new one', () => {
    let c = collectionWith([intercessors]);
    const a = makeCase(c);
    c = addCase(a)(c);
    c = distribute(c);
    expect(c.cases).toHaveLength(1);
    expect(c.cases[0].items).toEqual([{ unitId: intercessors.id, modelId: only(intercessors), count: 6 }]);
  });

  it('leaves bases that fit no case on the shelf', () => {
    const titan = makeUnit(2, { name: 'Titan', sizeX: 250, sizeY: 250, count: 1, heightMm: 120 });
    const c = distribute(collectionWith([titan]));
    expect(unassigned(c)).toEqual([{ unit: c.units[0], model: c.units[0].models[0], count: 1 }]);
  });

  it('keeps every model of a unit in one case when sorting by unit', () => {
    const c = distribute(collectionWith([lance, intercessors]));
    expect(holding(c, lance.id)).toHaveLength(1);
    expect(unassigned(c)).toEqual([]);
    expect(fitsAll(c)).toBe(true);
  });

  it('separates big and small models when sorting by size', () => {
    const c = distribute(collectionWith([lance, intercessors], 'size'));
    const big = holding(c, lance.id, lance.models[0].id);
    const drones = holding(c, lance.id, lance.models[1].id);
    expect(big).toHaveLength(1);
    expect(drones).toHaveLength(1);
    expect(big[0].id).not.toBe(drones[0].id);
    // The drones share a case with the infantry rather than a tall one.
    expect(big[0].items).toHaveLength(1);
    expect(unassigned(c)).toEqual([]);
    expect(fitsAll(c)).toBe(true);
  });

  it('splits models across cases to fill them when asked', () => {
    let c = collectionWith([intercessors], 'fill');
    const a = makeCase(c, { bin: { ...makeCase(c).bin, autoFootprint: false, unitsX: 1, unitsY: 1 } });
    c = addCase(a)(c);
    c = distribute(c);
    expect(holding(c, intercessors.id).length).toBeGreaterThan(1);
    expect(c.cases[0].items[0].count).toBeGreaterThan(0);
    expect(unassigned(c)).toEqual([]);
  });
});
