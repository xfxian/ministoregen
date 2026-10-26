/**
 * Share links: a whole collection or one bin packed into the URL hash, so it can be
 * opened on another device or by someone else without any server.
 *
 * To keep links short the payload is a compact form of the data (see docs/SHARE_LINKS.md):
 * ids are dropped and items point at units and models by position, anything equal to its
 * default is left out, and personal preview settings are not shared. The JSON is then
 * deflated and written as base64url. Decoding expands it back to an ordinary stored
 * collection or project and runs it through the same normalize functions as local
 * storage, so the usual version upgrades apply.
 */
import { PAD_LAYOUTS, padLayout } from './pockets';
import {
  BASE_SHAPES, DEFAULT_BIN, DEFAULT_LAYOUT, GROUP_COLORS, PROJECT_VERSION, isObject, normalizeProject,
} from './project';
import { NO_OVERHANG } from './reach';
import { COLLECTION_VERSION, normalizeCollection } from './collection';

// Bump when the compact form changes; decoders keep reading older forms.
export const SHARE_FORMAT_VERSION = 1;

/** Hash prefixes: a compressed collection, a compressed single bin, and the older uncompressed bin. */
export const COLLECTION_HASH = '#c=';
export const BIN_HASH = '#b=';
export const LEGACY_BIN_HASH = '#p=';

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Fields of `value` that differ from `defaults`, or undefined when none do. */
function changes(value, defaults) {
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (!(k in defaults) || !sameJson(v, defaults[k])) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

const SIDES = Object.keys(NO_OVERHANG);
const round2 = (v) => Math.round(v * 100) / 100;
const defaultPads = (m) => (m.shape === 'pads' ? padLayout(PAD_LAYOUTS[0], m.sizeX, m.sizeY) : []);

/**
 * Model fields with one-letter names in a link. Fields not listed here (added later)
 * still travel under their full name, so a link never silently drops a setting.
 */
const MODEL_FIELDS = {
  name: ['n', ''],
  shape: ['s', 'round', (v) => BASE_SHAPES.indexOf(v), (v) => BASE_SHAPES[v]],
  sizeX: ['x', 32],
  count: ['c', 1],
  heightMm: ['h', 30],
  pocketDepth: ['d', null],
  notches: ['k', false, (v) => (v ? 1 : 0), (v) => v === 1],
};

/**
 * A model or group without its id and defaults. `position` is its place in the whole
 * list: a colour that is simply the next palette colour is left out.
 */
function packModel(m, position) {
  const { id, sizeY, overhang, pads, color, ...rest } = m;
  void id;
  const out = {};
  for (const [field, value] of Object.entries(rest)) {
    const spec = MODEL_FIELDS[field];
    if (!spec) out[field] = value;
    else if (!sameJson(value, spec[1])) out[spec[0]] = spec[2] ? spec[2](value) : value;
  }
  // Round and square bases are as deep as they are wide.
  if (sizeY !== m.sizeX) out.y = sizeY;
  if (!sameJson(overhang, NO_OVERHANG)) {
    const sides = SIDES.map((side) => overhang[side]);
    out.o = sides.every((v) => v === sides[0]) ? sides[0] : sides;
  }
  if (!sameJson(pads, defaultPads(m))) {
    out.p = pads.map((pad) => [pad.x, pad.y, pad.sizeX, pad.sizeY].map(round2).concat(pad.shape === 'rect' ? [1] : []));
  }
  if (color !== GROUP_COLORS[position % GROUP_COLORS.length]) {
    const index = GROUP_COLORS.indexOf(color);
    out.l = index >= 0 ? index : color;
  }
  return out;
}

function unpackModel(packed, position) {
  const given = isObject(packed) ? packed : {};
  const known = new Set(['y', 'o', 'p', 'l']);
  const model = {};
  for (const [field, [key, fallback, , decode]] of Object.entries(MODEL_FIELDS)) {
    known.add(key);
    model[field] = key in given ? (decode ? decode(given[key]) : given[key]) : fallback;
  }
  for (const [field, value] of Object.entries(given)) if (!known.has(field)) model[field] = value;
  model.sizeY = 'y' in given ? given.y : model.sizeX;
  model.overhang = typeof given.o === 'number' ? given.o
    : Array.isArray(given.o) ? Object.fromEntries(SIDES.map((side, i) => [side, given.o[i]])) : { ...NO_OVERHANG };
  model.pads = Array.isArray(given.p)
    ? given.p.filter(Array.isArray).map(([x, y, sizeX, sizeY, rect]) => ({ x, y, sizeX, sizeY, shape: rect === 1 ? 'rect' : 'round' }))
    : defaultPads(model);
  model.color = typeof given.l === 'number' ? GROUP_COLORS[given.l]
    : given.l ?? GROUP_COLORS[position % GROUP_COLORS.length];
  return model;
}

/** Bin and layout settings of a case or project that differ from the defaults. */
function packSettings(out, { bin, layout }) {
  const b = changes(bin, DEFAULT_BIN);
  const l = changes(layout, DEFAULT_LAYOUT);
  if (b) out.b = b;
  if (l) out.l = l;
  return out;
}

const unpackSettings = (packed) => ({
  bin: { ...DEFAULT_BIN, ...(isObject(packed.b) ? packed.b : {}) },
  layout: { ...DEFAULT_LAYOUT, ...(isObject(packed.l) ? packed.l : {}) },
});

const list = (v) => (Array.isArray(v) ? v : []);

function checkVersion(data) {
  if (!isObject(data) || typeof data.v !== 'number') throw new Error('This link is damaged or incomplete.');
  if (data.v > SHARE_FORMAT_VERSION) throw new Error('This link needs a newer version of ministoregen.');
}

/**
 * Compact form of a collection, ready for JSON: units as [name, ...models], cases with
 * their items as one flat list of unit index, model index and count.
 */
export function packCollection(collection) {
  let position = 0;
  const unitIndex = new Map(collection.units.map((u, i) => [u.id, i]));
  const out = { v: SHARE_FORMAT_VERSION };
  if (collection.name !== 'My collection') out.n = collection.name;
  if (collection.sortMode !== 'units') out.s = collection.sortMode;
  out.u = collection.units.map((u) => [u.name, ...u.models.map((m) => packModel(m, position++))]);
  out.c = collection.cases.map((c, i) => {
    const packed = {};
    if (c.name !== `Case ${i + 1}`) packed.n = c.name;
    packSettings(packed, c);
    packed.i = c.items.flatMap((item) => {
      const u = unitIndex.get(item.unitId);
      const m = collection.units[u]?.models.findIndex((model) => model.id === item.modelId) ?? -1;
      return m >= 0 ? [u, m, item.count] : [];
    });
    return packed;
  });
  return out;
}

/** Expands a compact collection into stored form; `preview` is the viewer's own. */
export function unpackCollection(data, preview) {
  checkVersion(data);
  let position = 0;
  const units = list(data.u).filter(Array.isArray).map(([name, ...models], i) => ({
    id: `u${i}`,
    name,
    models: models.map((m, j) => ({ ...unpackModel(m, position++), id: `u${i}m${j}` })),
  }));
  const cases = list(data.c).filter(isObject).map((c, i) => {
    const items = [];
    const flat = list(c.i);
    for (let k = 0; k + 2 < flat.length; k += 3) {
      items.push({ unitId: `u${flat[k]}`, modelId: `u${flat[k]}m${flat[k + 1]}`, count: flat[k + 2] });
    }
    return { id: `c${i}`, name: typeof c.n === 'string' ? c.n : `Case ${i + 1}`, ...unpackSettings(c), items };
  });
  // The compact form always describes the current stored version.
  return normalizeCollection({
    version: COLLECTION_VERSION, name: data.n, sortMode: data.s, units, cases, preview,
  });
}

/** Compact form of a single-bin project, ready for JSON. */
export function packProject(project) {
  const out = { v: SHARE_FORMAT_VERSION, n: project.name, g: project.groups.map(packModel) };
  return packSettings(out, project);
}

/** Expands a compact project into stored form; `preview` is the viewer's own. */
export function unpackProject(data, preview) {
  checkVersion(data);
  return normalizeProject({
    version: PROJECT_VERSION,
    name: data.n,
    groups: list(data.g).map((g, i) => ({ ...unpackModel(g, i), id: `g${i}` })),
    ...unpackSettings(data),
    preview,
  });
}

// --- Bytes to text and back ---

export function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text) {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function pipe(bytes, transform) {
  const input = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
  const chunks = [];
  const reader = input.pipeThrough(transform).getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read()) chunks.push(r.value);
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  chunks.reduce((offset, c) => { out.set(c, offset); return offset + c.length; }, 0);
  return out;
}

export const deflate = (bytes) => pipe(bytes, new CompressionStream('deflate-raw'));
export const inflate = (bytes) => pipe(bytes, new DecompressionStream('deflate-raw'));

/** Packs JSON-ready data into URL-safe text. */
export async function encodePayload(data) {
  return toBase64Url(await deflate(new TextEncoder().encode(JSON.stringify(data))));
}

export async function decodePayload(text) {
  return JSON.parse(new TextDecoder().decode(await inflate(fromBase64Url(text))));
}
