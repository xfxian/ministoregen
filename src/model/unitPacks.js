/**
 * Unit packs: ready-made unit lists (names, models, bases, counts) that fill the
 * unit dialog. The app ships only a generic pack; packs naming the units of a game
 * are community files loaded by URL or from disk (see docs/UNIT_PACKS.md). A pack
 * holds facts about models, never rules, stats or artwork.
 */
import { makeModel, makeUnit } from './collection';
import { BASE_SHAPES, isObject, normalizeGroup } from './project';

export const UNIT_PACK_FORMAT = 'ministoregen-unit-pack';
export const UNIT_PACK_VERSION = 1;
export const MAX_PACK_UNITS = 5000;
const MAX_UNIT_MODELS = 12;

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Only http(s) links are shown as links; anything else is dropped. */
export function safeLink(value) {
  const v = text(value, 500);
  try {
    const url = new URL(v);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

/**
 * One model of a pack unit, or null when it has no usable base. Round and square
 * bases may leave out sizeY. Storage choices (pocket depth, notches, colour) are
 * not part of a pack: they belong to the person printing.
 */
function packModel(m) {
  if (!isObject(m) || !BASE_SHAPES.includes(m.shape)) return null;
  if (typeof m.sizeX !== 'number' || !Number.isFinite(m.sizeX)) return null;
  const sizeY = typeof m.sizeY === 'number' ? m.sizeY : m.sizeX;
  const g = normalizeGroup({ ...m, sizeY, count: m.count ?? 1, heightMm: m.heightMm ?? 30, notches: false, pocketDepth: null }, 0);
  return {
    name: text(m.name, 60),
    shape: g.shape,
    sizeX: g.sizeX,
    sizeY: g.sizeY,
    count: g.count,
    heightMm: g.heightMm,
    overhang: g.overhang,
    pads: g.pads,
  };
}

function packUnit(u) {
  if (!isObject(u)) return null;
  const name = text(u.name, 60);
  const models = Array.isArray(u.models) ? u.models.slice(0, MAX_UNIT_MODELS).map(packModel).filter(Boolean) : [];
  if (!name || !models.length) return null;
  return { name, category: text(u.category, 40), models };
}

/**
 * Reads a unit pack from JSON text or a parsed object. Throws when it is not a
 * pack; units that cannot be used are skipped and counted.
 */
export function parseUnitPack(input) {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      throw new Error('This file is not valid JSON.');
    }
  }
  if (!isObject(data) || data.format !== UNIT_PACK_FORMAT) {
    throw new Error('This is not a ministoregen unit library.');
  }
  if (typeof data.version !== 'number' || data.version > UNIT_PACK_VERSION) {
    throw new Error('This unit library needs a newer version of ministoregen.');
  }
  const raw = Array.isArray(data.units) ? data.units.slice(0, MAX_PACK_UNITS) : [];
  const units = raw.map(packUnit).filter(Boolean);
  if (!units.length) throw new Error('This unit library has no usable units.');
  return {
    format: UNIT_PACK_FORMAT,
    version: UNIT_PACK_VERSION,
    name: text(data.name, 80) || 'Unnamed library',
    description: text(data.description, 400),
    author: text(data.author, 80),
    licence: text(data.licence ?? data.license, 80),
    source: safeLink(data.source),
    units,
    skipped: raw.length - units.length,
  };
}

/** A new collection unit from a pack unit; colours continue from `colorIndex`. */
export function unitFromPack(entry, colorIndex = 0) {
  return makeUnit(colorIndex, {
    name: entry.name,
    models: entry.models.map((m, i) => makeModel(colorIndex + i, {
      ...m,
      overhang: { ...m.overhang },
      pads: m.pads.map((p) => ({ ...p })),
    })),
  });
}

const sizeLabel = (m) => {
  if (m.shape === 'round') return `Ø${m.sizeX}`;
  if (m.shape === 'pads') return `${m.sizeX} × ${m.sizeY} no base`;
  return `${m.sizeX} × ${m.sizeY} ${m.shape === 'rect' ? 'rectangle' : m.shape}`;
};

/** Short description of a pack unit's models, such as "1 × 60 × 35 oval + 2 × Ø32". */
export function packUnitSummary(entry) {
  return entry.models.map((m) => `${m.count} × ${sizeLabel(m)}`).join(' + ');
}

/** Units whose name or category contain every word of the query, in pack order. */
export function searchPack(pack, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return pack.units;
  return pack.units.filter((u) => {
    const hay = `${u.name} ${u.category} ${u.models.map((m) => m.name).join(' ')}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
