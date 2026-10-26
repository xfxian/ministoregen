import { describe, expect, it } from 'vitest';
import example from '../../docs/examples/unit-pack-example.json';
import { GENERIC_PACK } from './genericPack';
import {
  UNIT_PACK_FORMAT, packUnitSummary, parseUnitPack, safeLink, searchPack, unitFromPack,
} from './unitPacks';

const pack = (units, extra = {}) => ({ format: UNIT_PACK_FORMAT, version: 1, name: 'Test', units, ...extra });

describe('unit packs', () => {
  it('reads units with several models, filling in round sizes and defaults', () => {
    const result = parseUnitPack(JSON.stringify(pack([
      {
        name: 'Gun crew',
        category: 'Artillery',
        models: [
          { name: 'Gun', shape: 'oval', sizeX: 70, sizeY: 105, heightMm: 60 },
          { name: 'Crew', shape: 'round', sizeX: 25, count: 3, overhang: 4 },
        ],
      },
    ], { license: 'CC BY 4.0', source: 'https://example.com/packs' })));
    expect(result.licence).toBe('CC BY 4.0');
    expect(result.source).toBe('https://example.com/packs');
    const [unit] = result.units;
    expect(unit.category).toBe('Artillery');
    expect(unit.models[0]).toMatchObject({ shape: 'oval', sizeX: 70, sizeY: 105, count: 1, heightMm: 60 });
    expect(unit.models[1]).toMatchObject({ sizeX: 25, sizeY: 25, count: 3, heightMm: 30 });
    expect(unit.models[1].overhang).toEqual({ front: 4, right: 4, back: 4, left: 4 });
  });

  it('skips units without a name or a usable base, and rejects anything that is not a pack', () => {
    const result = parseUnitPack(pack([
      { name: 'Good', models: [{ shape: 'round', sizeX: 32 }] },
      { name: '', models: [{ shape: 'round', sizeX: 32 }] },
      { name: 'No base', models: [{ shape: 'hexagon', sizeX: 32 }] },
      'junk',
    ]));
    expect(result.units.map((u) => u.name)).toEqual(['Good']);
    expect(result.skipped).toBe(3);
    expect(() => parseUnitPack('{"format":"other"}')).toThrow(/not a ministoregen unit library/);
    expect(() => parseUnitPack('nope')).toThrow(/not valid JSON/);
    expect(() => parseUnitPack(pack([], { version: 2 }))).toThrow(/newer version/);
    expect(() => parseUnitPack(pack([]))).toThrow(/no usable units/);
  });

  it('drops links that are not http(s)', () => {
    expect(safeLink('javascript:alert(1)')).toBe('');
    expect(safeLink('https://github.com/x')).toBe('https://github.com/x');
    expect(parseUnitPack(pack([{ name: 'A', models: [{ shape: 'round', sizeX: 25 }] }], { source: 'data:text/html,hi' })).source).toBe('');
  });

  it('turns a pack unit into a collection unit with fresh ids and colours', () => {
    const entry = parseUnitPack(pack([{ name: 'Mixed', models: [{ shape: 'round', sizeX: 60 }, { shape: 'round', sizeX: 32, count: 2 }] }])).units[0];
    const a = unitFromPack(entry, 2);
    const b = unitFromPack(entry, 2);
    expect(a.name).toBe('Mixed');
    expect(a.models).toHaveLength(2);
    expect(a.id).not.toBe(b.id);
    expect(a.models[0].id).not.toBe(a.models[1].id);
    expect(a.models[0].color).not.toBe(a.models[1].color);
    a.models[0].overhang.front = 9;
    expect(entry.models[0].overhang.front).toBe(0);
    expect(packUnitSummary(entry)).toBe('1 × Ø60 + 2 × Ø32');
  });

  it('searches names and categories by every word', () => {
    expect(searchPack(GENERIC_PACK, 'oval monster').map((u) => u.name)).toEqual([
      'Monster on 105 × 70 mm oval', 'Monster on 120 × 92 mm oval',
    ]);
    expect(searchPack(GENERIC_PACK, '  ')).toBe(GENERIC_PACK.units);
  });

  it('ships a generic pack where every unit is usable', () => {
    expect(GENERIC_PACK.skipped).toBe(0);
    expect(GENERIC_PACK.units.length).toBeGreaterThan(20);
  });

  it('reads the documented example without skipping anything', () => {
    const result = parseUnitPack(example);
    expect(result.skipped).toBe(0);
    expect(result.units.map((u) => u.models.length)).toEqual([2, 1, 1, 2, 1]);
    expect(result.units[4].models[0].pads).toHaveLength(4);
  });
});
