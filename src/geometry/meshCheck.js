/**
 * Checks a binary STL for what a slicer needs: a closed, consistently oriented
 * surface without degenerate triangles, normals pointing outwards, and one body.
 * Used by the tests; returns measurements so callers can compare sizes and volume.
 */
export function inspectStl(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangles = view.getUint32(80, true);
  const problems = [];
  if (bytes.byteLength !== 84 + 50 * triangles) problems.push('file size does not match the triangle count');

  const ids = new Map();
  const vertex = (x, y, z) => {
    const key = `${x},${y},${z}`;
    let id = ids.get(key);
    if (id === undefined) {
      id = ids.size;
      ids.set(key, id);
    }
    return id;
  };
  const edges = new Map();
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let volume = 0;
  let degenerate = 0;
  let flippedNormals = 0;
  const faces = [];

  for (let t = 0; t < triangles; t++) {
    const o = 84 + 50 * t;
    const f = (i) => view.getFloat32(o + 4 * i, true);
    const n = [f(0), f(1), f(2)];
    const p = [[f(3), f(4), f(5)], [f(6), f(7), f(8)], [f(9), f(10), f(11)]];
    for (const q of p) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], q[k]); max[k] = Math.max(max[k], q[k]); }
    const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
    const w = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    const c = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const area2 = Math.hypot(...c);
    if (area2 < 1e-9) degenerate++;
    else if ((c[0] * n[0] + c[1] * n[1] + c[2] * n[2]) / area2 < 0.9) flippedNormals++;
    volume += (p[0][0] * (p[1][1] * p[2][2] - p[1][2] * p[2][1])
      - p[0][1] * (p[1][0] * p[2][2] - p[1][2] * p[2][0])
      + p[0][2] * (p[1][0] * p[2][1] - p[1][1] * p[2][0])) / 6;
    const v = p.map((q) => vertex(...q));
    if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) continue;
    faces.push(v);
    for (let k = 0; k < 3; k++) {
      const key = `${v[k]}>${v[(k + 1) % 3]}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }

  let openEdges = 0;
  let duplicateEdges = 0;
  for (const [key, count] of edges) {
    if (count > 1) duplicateEdges++;
    const [a, b] = key.split('>');
    if (!edges.has(`${b}>${a}`)) openEdges++;
  }
  if (degenerate) problems.push(`${degenerate} degenerate triangles`);
  if (flippedNormals) problems.push(`${flippedNormals} normals disagree with the winding`);
  if (openEdges) problems.push(`${openEdges} open or inconsistently wound edges`);
  if (duplicateEdges) problems.push(`${duplicateEdges} edges shared by more than two triangles`);
  if (volume <= 0) problems.push('the surface points inwards');

  // Connected bodies, via shared vertices.
  const parent = Array.from({ length: ids.size }, (_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (const [a, b, c] of faces) { parent[find(b)] = find(a); parent[find(c)] = find(a); }
  const bodies = new Set(faces.map(([a]) => find(a))).size;

  const edgeCount = edges.size / 2;
  const genus = bodies === 1 ? (2 - (ids.size - edgeCount + faces.length)) / 2 : NaN;
  return { triangles, volume, min, max, bodies, genus, problems };
}
