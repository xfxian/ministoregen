import { buildBinPart, buildInlayPart, buildLidPart } from './geometry/parts';

// Exports are built at this smoothness or higher, whatever the preview uses.
const EXPORT_SEGMENTS = 64;

export function slugify(name) {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'design';
}

// Default names: numbered ones still tell cases apart, the others say nothing about the item.
const NUMBERED_NAME = /^(case|group|unit) \d+$/i;
const PLACEHOLDER_NAME = /^my (miniatures|collection)$/i;

/** Five base-36 characters from a string (FNV-1a), for short names that change with their input. */
export function shortHash(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(36).padStart(7, '0').slice(-5);
}

/** Short, stable code for a design's geometry: same design, same code; any change, a new one. */
export function designCode(project) {
  return shortHash(JSON.stringify({
    groups: project.groups.map(({ shape, sizeX, sizeY, count, heightMm }) => [shape, sizeX, sizeY, count, heightMm]),
    bin: project.bin,
    layout: project.layout,
  }));
}

/**
 * File name base for a design, such as `case-2-orks-boyz-3x2x6u-k3f9a`: its name (plus its first
 * unit names when the name is a default like "Case 2" or "My miniatures"), its size in grid units,
 * and its design code, so downloads say what they hold and two different designs never share a name.
 */
export function printName(name, project, plan) {
  const trimmed = (name ?? '').trim();
  const placeholder = !trimmed || PLACEHOLDER_NAME.test(trimmed);
  const parts = placeholder ? [] : [slugify(trimmed)];
  if (placeholder || NUMBERED_NAME.test(trimmed)) {
    const units = project.groups.map((g) => slugify(g.name)).filter((s) => s !== 'design');
    parts.push(units.slice(0, 2).join('-'));
  }
  const label = parts.filter((s) => s && s !== 'design').join('-').slice(0, 48).replace(/-+$/, '') || 'bin';
  return `${label}-${plan.unitsX}x${plan.unitsY}x${plan.heightUnits}u-${designCode(project)}`;
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
export function buildPrintFiles(wasm, project, plan, baseName = printName(project.name, project, plan)) {
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
  const used = new Set();
  let offset = 0;
  for (const file of files) {
    const { data } = file;
    let name = file.name;
    for (let n = 2; used.has(name); n++) name = file.name.replace(/(\.[^.]*)?$/, `-${n}$1`);
    used.add(name);
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
