import { describe, expect, it } from 'vitest';
import {
  addUnit, distribute, makeCase, makeDefaultCollection, makeModel, makeUnit, normalizeCollection,
} from './collection';
import { GENERIC_PACK } from './genericPack';
import { makeDefaultProject, makeGroup } from './project';
import {
  decodePayload, encodePayload, packCollection, packProject, unpackCollection, unpackProject,
} from './share';
import { unitFromPack } from './unitPacks';

// Ids are not part of a link; compare everything else.
function withoutIds(c) {
  const unitIds = new Map(c.units.map((u, i) => [u.id, i]));
  const modelIds = new Map(c.units.flatMap((u) => u.models.map((m, j) => [`${u.id}/${m.id}`, j])));
  return {
    ...c,
    units: c.units.map((u) => ({ ...u, id: 0, models: u.models.map((m) => ({ ...m, id: 0 })) })),
    cases: c.cases.map((k) => ({
      ...k,
      id: 0,
      items: k.items.map((i) => ({ ...i, unitId: unitIds.get(i.unitId), modelId: modelIds.get(`${i.unitId}/${i.modelId}`) })),
    })),
  };
}

const viaJson = (data) => JSON.parse(JSON.stringify(data));

/** A collection that sets every model, bin and layout field away from its default somewhere. */
function everything() {
  let c = { ...makeDefaultCollection(), name: 'Strike force', sortMode: 'fill' };
  c = addUnit(makeUnit(0, { name: 'Squad', count: 4 }))(c);
  c = addUnit(makeUnit(1, {
    name: 'Tank with drones',
    models: [
      makeModel(1, { name: 'Tank', shape: 'pads', sizeX: 70, sizeY: 100, heightMm: 60, pads: [{ x: 0, y: 10.12, sizeX: 20, sizeY: 30, shape: 'rect' }] }),
      makeModel(2, { name: 'Drone', shape: 'oval', sizeX: 25, sizeY: 50, count: 2, overhang: { front: 3, right: 4, back: 5, left: 6 }, notches: true }),
      makeModel(3, { shape: 'square', sizeX: 40, sizeY: 40, overhang: { front: 7, right: 7, back: 7, left: 7 }, pocketDepth: 8, color: '#123456' }),
      makeModel(4, { shape: 'pads', sizeX: 100, sizeY: 140, color: makeGroup(0).color }),
    ],
  }))(c);
  const custom = makeCase(c, {
    name: 'Big box',
    bin: { ...makeCase(c).bin, lid: 'stackable', lidSnap: true, autoHeight: false, heightUnits: 9 },
    layout: { ...makeCase(c).layout, pocketMode: 'floor', spacing: 2.5 },
  });
  c = { ...c, cases: [custom, makeCase({ ...c, cases: [custom] })] };
  const [squad, tank] = c.units;
  c.cases[0].items = [{ unitId: tank.id, modelId: tank.models[1].id, count: 2 }, { unitId: squad.id, modelId: squad.models[0].id, count: 3 }];
  c.cases[1].items = [{ unitId: tank.id, modelId: tank.models[0].id, count: 1 }];
  return normalizeCollection(c);
}

/** A collection like people have: units from the generic library with their own names, sorted into cases. */
export function typicalCollection(unitCount) {
  const names = ['Battle line', 'Heavy weapons', 'Assault squad', 'Command squad', 'Captain', 'Walker', 'Bikers', 'Snipers',
    'Jump troops', 'Lieutenant', 'Veterans', 'Transport', 'Battle tank', 'Scouts', 'Elite guard', 'Librarian', 'Chaplain'];
  let c = { ...makeDefaultCollection(), name: 'My army' };
  let colour = 0;
  for (let i = 0; i < unitCount; i++) {
    const unit = unitFromPack(GENERIC_PACK.units[(i * 7) % GENERIC_PACK.units.length], colour);
    colour += unit.models.length;
    c = addUnit({ ...unit, name: `${names[i % names.length]} ${Math.floor(i / names.length) + 1}` })(c);
  }
  return distribute(c);
}

describe('share links', () => {
  it('round-trips a collection with every setting changed', async () => {
    const c = everything();
    const back = unpackCollection(await decodePayload(await encodePayload(packCollection(c))), c.preview);
    expect(withoutIds(back)).toEqual(withoutIds(c));
  });

  it('round-trips the plain default collection and a sorted one', () => {
    for (const c of [makeDefaultCollection(), typicalCollection(12)]) {
      expect(withoutIds(unpackCollection(viaJson(packCollection(c)), c.preview))).toEqual(withoutIds(c));
    }
  });

  it('leaves out defaults, ids and preview settings', () => {
    const c = addUnit(makeUnit(0, { name: 'Squad', count: 5, sizeX: 25, sizeY: 25 }))(makeDefaultCollection());
    expect(packCollection(c)).toEqual({ v: 1, u: [['Squad', { x: 25, c: 5 }]], c: [] });
  });

  it('keeps model fields it does not know under their full name', () => {
    const c = addUnit(makeUnit(0, { name: 'Squad' }))(makeDefaultCollection());
    c.units[0].models[0].magnets = 2;
    expect(packCollection(c).u[0][1].magnets).toBe(2);
  });

  it('round-trips a single bin', async () => {
    const p = {
      ...makeDefaultProject(),
      name: 'Tray',
      groups: [makeGroup(0, { name: 'A', overhang: { front: 1, right: 0, back: 0, left: 0 } }), makeGroup(1, { name: 'B', shape: 'oval', sizeY: 60 })],
      bin: { ...makeDefaultProject().bin, lid: 'flat' },
    };
    const back = unpackProject(await decodePayload(await encodePayload(packProject(p))), p.preview);
    const strip = (x) => ({ ...x, groups: x.groups.map((g) => ({ ...g, id: 0 })) });
    expect(strip(back)).toEqual(strip(p));
  });

  it('refuses links from a newer version and damaged data', () => {
    expect(() => unpackCollection({ v: 99 })).toThrow(/newer version/);
    expect(() => unpackProject('nonsense')).toThrow(/damaged/);
  });

  it('repairs hostile values like any stored collection', () => {
    const c = unpackCollection({ v: 1, u: [['X', { x: 1e9, c: -4, s: 42, l: 'red' }]], c: [{ i: [0, 0, 999, 5] }] });
    expect(c.units[0].models[0]).toMatchObject({ sizeX: 200, count: 1, shape: 'round' });
    expect(c.cases[0].items).toEqual([{ unitId: 'u0', modelId: 'u0m0', count: 1 }]);
  });

  it('keeps links for typical collections short', async () => {
    const lengths = await Promise.all([8, 20, 40].map(async (n) => (await encodePayload(packCollection(typicalCollection(n)))).length));
    // Measured 2026-10-26: 310, 610 and 880 characters; see docs/SHARE_LINKS.md.
    expect(lengths[0]).toBeLessThan(450);
    expect(lengths[1]).toBeLessThan(850);
    expect(lengths[2]).toBeLessThan(1250);
  }, 30000);
});
