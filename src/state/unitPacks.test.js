import { beforeEach, describe, expect, it } from 'vitest';
import { UNIT_PACK_FORMAT } from '../model/unitPacks';
import {
  deleteUnitPack, fetchUnitPack, listUnitPacks, readUnitPackText, saveUnitPack,
} from './unitPacks';

const text = (name = 'Community') => JSON.stringify({
  format: UNIT_PACK_FORMAT, version: 1, name, units: [{ name: 'Squad', models: [{ shape: 'round', sizeX: 32, count: 5 }] }],
});
const respond = (body, status = 200) => async () => ({ ok: status < 400, status, text: async () => body });

describe('stored unit packs', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps packs, replacing one from the same URL', () => {
    saveUnitPack(readUnitPackText(text('One')), 'https://example.com/a.json');
    saveUnitPack(readUnitPackText(text('Two')), 'https://example.com/a.json');
    saveUnitPack(readUnitPackText(text('File')));
    const packs = listUnitPacks();
    expect(packs.map((p) => p.pack.name)).toEqual(['Two', 'File']);
    deleteUnitPack(packs[0].id);
    expect(listUnitPacks().map((p) => p.pack.name)).toEqual(['File']);
  });

  it('loads a pack over https only and reports server errors', async () => {
    await expect(fetchUnitPack('https://example.com/p.json', respond(text()))).resolves.toMatchObject({ name: 'Community' });
    await expect(fetchUnitPack('http://example.com/p.json', respond(text()))).rejects.toThrow(/https/);
    await expect(fetchUnitPack('not a url', respond(text()))).rejects.toThrow(/valid web address/);
    await expect(fetchUnitPack('https://example.com/p.json', respond('', 404))).rejects.toThrow(/404/);
    await expect(fetchUnitPack('https://example.com/p.json', async () => { throw new TypeError('cors'); })).rejects.toThrow(/other sites/);
  });

  it('refuses very large files', () => {
    expect(() => readUnitPackText(' '.repeat(2_000_001))).toThrow(/too large/);
  });
});
