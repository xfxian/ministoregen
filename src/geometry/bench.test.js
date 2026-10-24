// @vitest-environment node
// Rough timing for the heaviest realistic designs; run with BENCH=1 npx vitest run src/geometry/bench.test.js
import Module from 'manifold-3d';
import { describe, it } from 'vitest';
import { planProject } from '../model/layout';
import { makeDefaultProject, makeGroup } from '../model/project';
import { buildBinPart, buildInlayPart } from './parts';

describe.skipIf(!process.env.BENCH)('geometry timing', () => {
  it('builds large bins quickly enough for live preview', async () => {
    const wasm = await Module();
    wasm.setup();
    for (const [mode, segments] of [['inlay', 32], ['floor', 32], ['floor', 64]]) {
      const p = makeDefaultProject();
      p.layout.pocketMode = mode;
      p.preview.segments = segments;
      p.groups = [makeGroup(0, { sizeX: 25, sizeY: 25, count: 60 }), makeGroup(1, { sizeX: 32, sizeY: 32, count: 20 })];
      const plan = planProject(p);
      const t0 = performance.now();
      const bin = buildBinPart(wasm, p, plan);
      bin.getMesh();
      const t1 = performance.now();
      const inlay = plan.inlay ? buildInlayPart(wasm, p, plan) : null;
      inlay?.getMesh();
      const t2 = performance.now();
      const pockets = plan.strips.reduce((n, s) => n + s.capacity, 0);
      console.log(`${mode} ${segments} seg, ${plan.unitsX}x${plan.unitsY}, ${pockets} pockets: bin ${(t1 - t0).toFixed(0)} ms, inlay ${(t2 - t1).toFixed(0)} ms, ${bin.numTri()} tris`);
      bin.delete(); inlay?.delete();
    }
  });
});
