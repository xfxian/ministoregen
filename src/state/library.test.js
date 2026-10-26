import { beforeEach, describe, expect, it } from 'vitest';
import { addUnit, makeDefaultCollection, makeUnit } from '../model/collection';
import { makeDefaultProject } from '../model/project';
import { GENERIC_PACK } from '../model/genericPack';
import { backupFileName, deleteDesign, exportLibrary, importLibrary, listDesigns, saveDesign } from './library';
import { listUnitPacks, saveUnitPack } from './unitPacks';

beforeEach(() => window.localStorage.clear());

describe('design library', () => {
  it('saves, updates and deletes designs', () => {
    const p = makeDefaultProject();
    const id = saveDesign({ ...p, name: 'Tray A' });
    saveDesign({ ...p, name: 'Tray B' });
    saveDesign({ ...p, name: 'Tray A v2' }, id);
    expect(listDesigns().map((d) => d.project.name).sort()).toEqual(['Tray A v2', 'Tray B']);
    deleteDesign(id);
    expect(listDesigns().map((d) => d.project.name)).toEqual(['Tray B']);
  });

  it('round-trips through an exported file', () => {
    saveDesign({ ...makeDefaultProject(), name: 'Backup me' });
    const collection = addUnit(makeUnit(0, { name: 'Intercessors' }))(makeDefaultCollection());
    const file = exportLibrary(collection);
    window.localStorage.clear();
    const result = importLibrary(file);
    expect(result.count).toBe(1);
    expect(result.collection.units[0].name).toBe('Intercessors');
    expect(listDesigns()[0].project.name).toBe('Backup me');
  });

  it('backs up the single bin and unit libraries too', () => {
    saveUnitPack({ ...GENERIC_PACK, name: 'From a friend' }, 'https://example.com/pack.json');
    const file = exportLibrary(makeDefaultCollection(), { ...makeDefaultProject(), name: 'Open bin' });
    window.localStorage.clear();
    const result = importLibrary(file);
    expect(result).toMatchObject({ packs: 1, project: { name: 'Open bin' } });
    expect(listUnitPacks()).toMatchObject([{ url: 'https://example.com/pack.json', pack: { name: 'From a friend' } }]);
  });

  it('still reads backups made before the single bin was included', () => {
    const old = JSON.stringify({ format: 'ministoregen-library', version: 1, designs: [], collection: makeDefaultCollection() });
    expect(importLibrary(old)).toMatchObject({ count: 0, packs: 0, project: null });
  });

  it('names backups by date', () => {
    expect(backupFileName(new Date(2026, 9, 6))).toBe('ministoregen-backup-2026-10-06.json');
  });

  it('rejects files that are not library exports', () => {
    expect(() => importLibrary('{"hello":1}')).toThrow(/not a ministoregen library/);
  });
});
