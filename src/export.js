import { buildBinPart, buildInlayPart, buildLidPart } from './geometry/parts';

// Exports are built at this smoothness or higher, whatever the preview uses.
const EXPORT_SEGMENTS = 64;

export function slugify(name) {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'design';
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Binary STL of a Manifold (model coordinates, Z up, millimetres). */
export function manifoldToStl(manifold) {
  const { vertProperties: v, triVerts: t, numProp } = manifold.getMesh();
  const triangles = t.length / 3;
  const buffer = new ArrayBuffer(84 + 50 * triangles);
  const view = new DataView(buffer);
  view.setUint32(80, triangles, true);
  let offset = 84;
  const p = (i) => [v[i * numProp], v[i * numProp + 1], v[i * numProp + 2]];
  for (let k = 0; k < triangles; k++) {
    const a = p(t[3 * k]);
    const b = p(t[3 * k + 1]);
    const c = p(t[3 * k + 2]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const len = Math.hypot(...n) || 1;
    for (const value of [...n.map((x) => x / len), ...a, ...b, ...c]) {
      view.setFloat32(offset, value, true);
      offset += 4;
    }
    offset += 2; // attribute byte count
  }
  return new Uint8Array(buffer);
}

/** STL files for one design: the bin, plus the inlay and the lid when the design has them. */
export function buildPrintFiles(wasm, project, plan, baseName = slugify(project.name)) {
  const exportProject = { ...project, preview: { ...project.preview, segments: Math.max(EXPORT_SEGMENTS, project.preview.segments) } };
  const files = [];
  const add = (name, manifold) => {
    files.push({ name, data: manifoldToStl(manifold) });
    manifold.delete();
  };
  add(`${baseName}-bin.stl`, buildBinPart(wasm, exportProject, plan));
  if (plan.inlay) add(`${baseName}-inlay.stl`, buildInlayPart(wasm, exportProject, plan));
  if (plan.lid) add(`${baseName}-lid.stl`, buildLidPart(wasm, exportProject, plan));
  return files;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A zip archive without compression: enough to bundle several STL files into one download. */
export function zipFiles(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 file names
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
