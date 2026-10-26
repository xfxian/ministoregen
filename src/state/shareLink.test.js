import { describe, expect, it } from 'vitest';
import { addUnit, makeDefaultCollection, makeUnit } from '../model/collection';
import { encodeProject, makeDefaultProject } from '../model/project';
import { binHash, collectionLink, readShareLink } from './shareLink';

describe('reading share links', () => {
  it('opens a collection link', async () => {
    const c = addUnit(makeUnit(0, { name: 'Scouts' }))({ ...makeDefaultCollection(), name: 'Mine' });
    const link = await collectionLink(c);
    const shared = await readShareLink(new URL(link).hash);
    expect(shared.kind).toBe('collection');
    expect(shared.value.name).toBe('Mine');
    expect(shared.value.units[0].name).toBe('Scouts');
  });

  it('opens single-bin links, including the older uncompressed ones', async () => {
    const p = { ...makeDefaultProject(), name: 'Tray' };
    expect((await readShareLink(await binHash(p))).value.name).toBe('Tray');
    expect((await readShareLink(`#p=${encodeProject(p)}`))).toMatchObject({ kind: 'bin', value: { name: 'Tray' } });
  });

  it('reports a damaged link and ignores other hashes', async () => {
    expect((await readShareLink('#c=AAAA')).error).toMatch(/damaged/);
    expect((await readShareLink('#p=%%%')).error).toMatch(/damaged/);
    expect(await readShareLink('')).toBeNull();
    expect(await readShareLink('#section')).toBeNull();
  });
});
