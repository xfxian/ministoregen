import { beforeEach, describe, expect, it } from 'vitest';
import { makeDefaultProject } from '../model/project';
import { deleteDesign, exportLibrary, importLibrary, listDesigns, saveDesign } from './library';

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
    const file = exportLibrary();
    window.localStorage.clear();
    expect(importLibrary(file)).toBe(1);
    expect(listDesigns()[0].project.name).toBe('Backup me');
  });

  it('rejects files that are not library exports', () => {
    expect(() => importLibrary('{"hello":1}')).toThrow(/not a ministoregen library/);
  });
});
