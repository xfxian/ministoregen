// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildPrintFiles, manifoldToStl, zipFiles } from './export';
import Module from 'manifold-3d';
import { planProject } from './model/layout';
import { makeDefaultProject } from './model/project';

let wasmPromise;
function loadManifoldForTests() {
  wasmPromise ??= Module().then((wasm) => { wasm.setup(); return wasm; });
  return wasmPromise;
}

describe('export', () => {
  it('writes a binary STL with one record per triangle', async () => {
    const wasm = await loadManifoldForTests();
    const cube = wasm.Manifold.cube([10, 10, 10]);
    const stl = manifoldToStl(cube);
    const triangles = new DataView(stl.buffer).getUint32(80, true);
    expect(triangles).toBe(cube.numTri());
    expect(stl.length).toBe(84 + 50 * triangles);
    cube.delete();
  });

  it('builds the bin and the inlay for an inlay design', async () => {
    const wasm = await loadManifoldForTests();
    const project = makeDefaultProject();
    const files = buildPrintFiles(wasm, project, planProject(project), 'tray');
    expect(files.map((f) => f.name)).toEqual(['tray-bin.stl', 'tray-inlay.stl']);
  });

  it('bundles files into a zip with a valid directory', async () => {
    const files = [
      { name: 'a.stl', data: new Uint8Array([1, 2, 3]) },
      { name: 'b.stl', data: new Uint8Array([4, 5]) },
    ];
    const bytes = new Uint8Array(await zipFiles(files).arrayBuffer());
    const view = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const dirOffset = view.getUint32(end + 16, true);
    expect(view.getUint32(dirOffset, true)).toBe(0x02014b50);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
  });
});
