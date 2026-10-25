/**
 * The project is the single source of truth: what the user wants to store and
 * how the bin should be built. Everything else (bin size, layout, warnings) is
 * derived from it by planProject().
 */

export const BASE_SHAPES = ['round', 'oval', 'square', 'rect'];

export const BASE_PRESETS = {
  round: [25, 28.5, 32, 40, 50, 60, 80, 100].map((d) => ({ label: `${d} mm`, sizeX: d, sizeY: d })),
  oval: [
    [25, 50], [35.5, 60], [40, 75], [60, 95], [90, 120],
  ].map(([x, y]) => ({ label: `${x} × ${y} mm`, sizeX: x, sizeY: y })),
  square: [20, 25, 40, 50].map((d) => ({ label: `${d} mm`, sizeX: d, sizeY: d })),
  rect: [
    [25, 50], [50, 75], [50, 100],
  ].map(([x, y]) => ({ label: `${x} × ${y} mm`, sizeX: x, sizeY: y })),
};

// Picked to stay distinct on the dark drafting background, also in lightness.
export const GROUP_COLORS = ['#6fd3ff', '#ffc861', '#c9a7f5', '#7bd88f', '#ff8a80', '#4fd1c5', '#f48fb1', '#e6ee9c'];

export const POCKET_MODES = ['inlay', 'floor'];

export const DEFAULT_LAYOUT = {
  pocketMode: 'inlay', // 'inlay': separate drop-in part; 'floor': pockets cut into the bin floor
  pocketDepth: 3, // depth of floor pockets
  baseClearance: 0.4, // added to each base size for the pocket
  spacing: 1, // material between pockets
  margin: 1, // material between pockets and the inlay edge
  curvature: 0.55, // Bézier control factor for round/oval pockets
  inlayDepth: 3,
  inlayClearance: 0.5, // inlay is this much smaller than the lip opening
  inlayCornerRadius: 1,
};

export const DEFAULT_BIN = {
  autoFootprint: true,
  unitsX: 2,
  unitsY: 3,
  autoHeight: true,
  heightUnits: 6,
  lip: true,
  feet: true,
  wall: 0.95,
  floor: 1.2,
  maxUnits: 5, // 210 mm, fits most printer beds
};

export const DEFAULT_PREVIEW = {
  color: '#9aa4b1',
  wireframe: false,
  showMinis: true,
  segments: 32,
};

let nextId = 1;
const newId = () => `g${Date.now().toString(36)}${(nextId++).toString(36)}`;

export function makeGroup(index = 0, overrides = {}) {
  return {
    id: newId(),
    name: `Group ${index + 1}`,
    shape: 'round',
    sizeX: 32,
    sizeY: 32,
    count: 10,
    heightMm: 30,
    color: GROUP_COLORS[index % GROUP_COLORS.length],
    ...overrides,
  };
}

export function makeDefaultProject() {
  return {
    version: 1,
    name: 'My miniatures',
    groups: [makeGroup(0, { name: 'Infantry' })],
    bin: { ...DEFAULT_BIN },
    layout: { ...DEFAULT_LAYOUT },
    preview: { ...DEFAULT_PREVIEW },
  };
}

/** True for the untouched starter project (ignoring generated ids). */
export function isDefaultProject(project) {
  const strip = (p) => JSON.stringify({ name: p.name, groups: p.groups.map((g) => ({ ...g, id: undefined })) });
  return strip(project) === strip(makeDefaultProject());
}

export const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, fallback, min = -Infinity, max = Infinity) =>
  (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);

/** Repairs one stored or shared group (also used for collection units). */
export function normalizeGroup(g, index) {
  const d = makeGroup(index);
  if (!isObject(g)) return d;
  return {
    id: typeof g.id === 'string' ? g.id : d.id,
    name: typeof g.name === 'string' ? g.name.slice(0, 60) : d.name,
    shape: BASE_SHAPES.includes(g.shape) ? g.shape : d.shape,
    sizeX: num(g.sizeX, d.sizeX, 5, 200),
    sizeY: num(g.sizeY, d.sizeY, 5, 200),
    count: Math.round(num(g.count, d.count, 1, 500)),
    heightMm: num(g.heightMm, d.heightMm, 1, 300),
    color: typeof g.color === 'string' && /^#[0-9a-f]{6}$/i.test(g.color) ? g.color : d.color,
  };
}

/** Takes known settings from `given`, falling back to `defaults` for anything missing or invalid. */
export function normalizeSettings(defaults, given) {
  return Object.fromEntries(Object.entries(defaults).map(([k, v]) => {
    const g = isObject(given) ? given[k] : undefined;
    if (typeof v === 'boolean') return [k, typeof g === 'boolean' ? g : v];
    if (typeof v === 'number') return [k, num(g, v, 0, 1000)];
    if (k === 'pocketMode') return [k, POCKET_MODES.includes(g) ? g : v];
    return [k, typeof g === typeof v ? g : v];
  }));
}

/** Fills in missing or invalid fields so stored or shared projects never break the app. */
export function normalizeProject(raw) {
  const base = makeDefaultProject();
  if (!isObject(raw)) return base;
  const groups = Array.isArray(raw.groups)
    ? raw.groups.filter(isObject).slice(0, 24).map(normalizeGroup)
    : base.groups;
  return {
    version: 1,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : base.name,
    groups,
    bin: normalizeSettings(DEFAULT_BIN, raw.bin),
    layout: normalizeSettings(DEFAULT_LAYOUT, raw.layout),
    preview: normalizeSettings(DEFAULT_PREVIEW, raw.preview),
  };
}

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded) {
  const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** Encodes the project for the URL hash. Preview settings are personal and not shared. */
export function encodeProject(project) {
  const shared = { ...project };
  delete shared.preview;
  return toBase64Url(JSON.stringify(shared));
}

export function decodeProject(encoded) {
  try {
    return normalizeProject(JSON.parse(fromBase64Url(encoded)));
  } catch {
    return null;
  }
}
