/**
 * The collection: every unit someone owns, and the cases (bins) they are stored in.
 * A unit is made of one or more models, each with its own base, height and count
 * (say a vehicle on a 60 mm base and two drones on 25 mm bases). A case holds a count
 * per model of a unit; anything not assigned waits on the shelf. Each case turns into
 * an ordinary project (see caseProject), so planning, geometry and export work exactly
 * as for a single bin.
 */
import { planProject } from './layout';
import { reachBox } from './reach';
import {
  DEFAULT_BIN, DEFAULT_LAYOUT, DEFAULT_PREVIEW, PROJECT_VERSION, isObject, makeGroup, normalizeBin, normalizeGroup,
  normalizeSettings,
} from './project';

// 2: thicker default wall (see normalizeBin); 3: units hold several models;
// 4: overhang per side (see normalizeGroup).
export const COLLECTION_VERSION = 4;

/**
 * How "Sort into cases" groups miniatures:
 * - units: every unit stays in one case with all its models, unless it cannot fit one case;
 * - size: models are sorted on their own, and big and small ones go into separate cases;
 * - fill: anything may be split across cases to use as little plastic as possible.
 */
export const SORT_MODES = ['units', 'size', 'fill'];

let nextId = 1;
const newId = (prefix) => `${prefix}${Date.now().toString(36)}${(nextId++).toString(36)}`;

const MODEL_FIELDS = ['shape', 'sizeX', 'sizeY', 'count', 'heightMm', 'overhang', 'pocketDepth', 'notches', 'pads', 'color'];

export function makeModel(index = 0, overrides = {}) {
  return makeGroup(index, { name: '', count: 1, ...overrides, id: overrides.id ?? newId('m') });
}

/**
 * A new unit. Without `models`, model fields among the overrides (shape, size, count,
 * height, overhang, colour) describe its one model.
 */
export function makeUnit(index = 0, overrides = {}) {
  const { models, name, id } = overrides;
  const first = Object.fromEntries(MODEL_FIELDS.filter((k) => k in overrides).map((k) => [k, overrides[k]]));
  return {
    id: id ?? newId('u'),
    name: name ?? `Unit ${index + 1}`,
    models: models ?? [makeModel(index, { count: 5, ...first })],
  };
}

/** Name of one model of a unit as shown in a case: the unit, plus the model when there are several. */
export function modelLabel(unit, model) {
  if (unit.models.length < 2) return unit.name;
  return `${unit.name} · ${model.name || `Model ${unit.models.indexOf(model) + 1}`}`;
}

export const unitTotal = (unit) => unit.models.reduce((n, m) => n + m.count, 0);

const lineKey = (unitId, modelId) => `${unitId}/${modelId}`;
const itemCount = (c, unitId, modelId) => c.items
  .filter((i) => i.unitId === unitId && i.modelId === modelId)
  .reduce((n, i) => n + i.count, 0);

export function makeCase(collection, overrides = {}) {
  // New cases take their settings from the newest case, so a chosen style carries over.
  const template = collection.cases.at(-1);
  const number = collection.cases.reduce((n, c) => {
    const m = /^Case (\d+)$/.exec(c.name);
    return m ? Math.max(n, Number(m[1])) : n;
  }, 0) + 1;
  return {
    id: newId('c'),
    name: `Case ${number}`,
    bin: { ...(template?.bin ?? DEFAULT_BIN), autoFootprint: true, autoHeight: true },
    layout: { ...(template?.layout ?? DEFAULT_LAYOUT) },
    items: [],
    ...overrides,
  };
}

export function makeDefaultCollection() {
  return {
    version: COLLECTION_VERSION, name: 'My collection', units: [], cases: [], sortMode: 'units', preview: { ...DEFAULT_PREVIEW },
  };
}

function normalizeUnit(u, index) {
  // Versions 1 and 2 stored one base per unit, with the model fields on the unit itself.
  const rawModels = Array.isArray(u.models) ? u.models.filter(isObject).slice(0, 12) : [{ ...u, id: `${u.id}m`, name: '' }];
  const models = rawModels.map((m, i) => {
    const model = normalizeGroup(m, index + i);
    return { ...model, id: typeof m.id === 'string' ? m.id : newId('m'), name: typeof m.name === 'string' ? m.name.slice(0, 60) : '' };
  });
  return {
    id: typeof u.id === 'string' ? u.id : newId('u'),
    name: typeof u.name === 'string' ? u.name.slice(0, 60) : `Unit ${index + 1}`,
    models: models.length ? models : [makeModel(index)],
  };
}

/** Repairs a stored or imported collection so it can never break the app, and upgrades older versions. */
export function normalizeCollection(raw) {
  const base = makeDefaultCollection();
  if (!isObject(raw)) return base;
  const units = Array.isArray(raw.units) ? raw.units.filter(isObject).slice(0, 200).map(normalizeUnit) : [];
  const firstModel = new Map(units.map((u) => [u.id, u.models[0].id]));
  const cases = Array.isArray(raw.cases) ? raw.cases.filter(isObject).slice(0, 100).map((c, i) => ({
    id: typeof c.id === 'string' ? c.id : newId('c'),
    name: typeof c.name === 'string' ? c.name.slice(0, 60) : `Case ${i + 1}`,
    bin: normalizeBin(c.bin, raw.version),
    layout: normalizeSettings(DEFAULT_LAYOUT, c.layout),
    items: Array.isArray(c.items) ? c.items.filter(isObject).map((item) => ({
      unitId: String(item.unitId),
      // Items from versions 1 and 2 point at a unit only; that unit had exactly one model.
      modelId: typeof item.modelId === 'string' ? item.modelId : firstModel.get(String(item.unitId)) ?? '',
      count: Math.max(0, Math.round(Number(item.count) || 0)),
    })) : [],
  })) : [];
  const legacySort = typeof raw.keepTogether === 'boolean' ? (raw.keepTogether ? 'units' : 'fill') : base.sortMode;
  return clampAssignments({
    version: COLLECTION_VERSION,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : base.name,
    units,
    cases,
    sortMode: SORT_MODES.includes(raw.sortMode) ? raw.sortMode : legacySort,
    preview: normalizeSettings(DEFAULT_PREVIEW, raw.preview),
  });
}

/** How many of one model of a unit sit in cases (all but `exceptCaseId`); without `modelId`, of the whole unit. */
export function assignedCount(collection, unitId, modelId, exceptCaseId) {
  return collection.cases.reduce((n, c) => (c.id === exceptCaseId ? n : n + c.items
    .filter((i) => i.unitId === unitId && (modelId === undefined || i.modelId === modelId))
    .reduce((m, i) => m + i.count, 0)), 0);
}

/** Models with miniatures that are not in any case yet, in collection order. */
export function unassigned(collection) {
  return collection.units.flatMap((unit) => unit.models
    .map((model) => ({ unit, model, count: model.count - assignedCount(collection, unit.id, model.id) }))
    .filter((e) => e.count > 0));
}

/** Units with miniatures waiting on the shelf, with their waiting models. */
export function waitingUnits(collection) {
  const byUnit = new Map();
  for (const entry of unassigned(collection)) {
    if (!byUnit.has(entry.unit.id)) byUnit.set(entry.unit.id, { unit: entry.unit, models: [], count: 0 });
    const w = byUnit.get(entry.unit.id);
    w.models.push(entry);
    w.count += entry.count;
  }
  return [...byUnit.values()];
}

/** The case as a plain project, ready for planProject and the geometry builders: one group per model. */
export function caseProject(collection, c, preview = collection.preview ?? DEFAULT_PREVIEW) {
  const byId = new Map(collection.units.map((u) => [u.id, u]));
  const groups = c.items
    .map((i) => {
      const unit = byId.get(i.unitId);
      const model = unit?.models.find((m) => m.id === i.modelId);
      return model && i.count > 0
        ? { ...model, id: lineKey(unit.id, model.id), name: modelLabel(unit, model), count: i.count }
        : null;
    })
    .filter(Boolean);
  return { version: PROJECT_VERSION, name: c.name, groups, bin: c.bin, layout: c.layout, preview };
}

/** The group id caseProject gives one model of a unit, for highlighting it in drawings. */
export const caseGroupId = lineKey;

/**
 * Keeps assignments consistent: items point at existing models, each model appears once
 * per case, and no model is assigned more often than it is owned (later cases give way).
 */
export function clampAssignments(collection) {
  const owned = new Map(collection.units.flatMap((u) => u.models.map((m) => [lineKey(u.id, m.id), m.count])));
  let cases = collection.cases.map((c) => {
    const merged = new Map();
    for (const item of c.items) {
      const key = lineKey(item.unitId, item.modelId);
      if (!owned.has(key) || item.count <= 0) continue;
      const prev = merged.get(key);
      merged.set(key, { unitId: item.unitId, modelId: item.modelId, count: (prev?.count ?? 0) + item.count });
    }
    return { ...c, items: [...merged.values()] };
  });
  const left = new Map(owned);
  cases = cases.map((c) => ({
    ...c,
    items: c.items
      .map((item) => {
        const key = lineKey(item.unitId, item.modelId);
        const count = Math.min(item.count, left.get(key));
        left.set(key, left.get(key) - count);
        return { ...item, count };
      })
      .filter((item) => item.count > 0),
  }));
  const unchanged = cases.every((c, i) => JSON.stringify(c.items) === JSON.stringify(collection.cases[i].items));
  return unchanged ? collection : { ...collection, cases };
}

// --- Updates: each returns a function from collection to collection. ---

/**
 * Adds the units and cases of another collection (from a share link, say) to this one.
 * Everything gets new ids, so nothing clashes with what is already there.
 */
export function addCollection(collection, other) {
  const ids = new Map();
  const units = other.units.map((u) => {
    const id = newId('u');
    return {
      ...u,
      id,
      models: u.models.map((m) => {
        const modelId = newId('m');
        ids.set(lineKey(u.id, m.id), [id, modelId]);
        return { ...m, id: modelId };
      }),
    };
  });
  const cases = other.cases.map((c) => ({
    ...c,
    id: newId('c'),
    items: c.items.flatMap((item) => {
      const target = ids.get(lineKey(item.unitId, item.modelId));
      return target ? [{ unitId: target[0], modelId: target[1], count: item.count }] : [];
    }),
  }));
  return { ...collection, units: [...collection.units, ...units], cases: [...collection.cases, ...cases] };
}

export const setCollectionName = (name) => (c) => ({ ...c, name });
export const setSortMode = (sortMode) => (c) => ({ ...c, sortMode });

export const addUnit = (unit) => (c) => ({ ...c, units: [...c.units, unit] });
export const patchUnit = (id, patch) => (c) => clampAssignments({
  ...c,
  units: c.units.map((u) => (u.id === id ? { ...u, ...patch } : u)),
});
export const removeUnit = (id) => (c) => clampAssignments({ ...c, units: c.units.filter((u) => u.id !== id) });

export const addCase = (newCase) => (c) => ({ ...c, cases: [...c.cases, newCase] });
export const removeCase = (id) => (c) => ({ ...c, cases: c.cases.filter((x) => x.id !== id) });
export const patchCase = (id, patch) => (c) => ({
  ...c,
  cases: c.cases.map((x) => (x.id === id ? { ...x, ...patch } : x)),
});
export const patchCaseBin = (id, patch) => (c) => ({
  ...c,
  cases: c.cases.map((x) => (x.id === id ? { ...x, bin: { ...x.bin, ...patch } } : x)),
});
/**
 * Applies a project update (as used by the single-bin settings panels) to one case's
 * bin and layout settings and to the shared preview settings.
 */
export const updateCaseSettings = (id, recipe) => (c) => {
  const target = c.cases.find((x) => x.id === id);
  if (!target) return c;
  const before = { bin: target.bin, layout: target.layout, preview: c.preview ?? DEFAULT_PREVIEW };
  const after = recipe(before);
  if (after === before) return c;
  return { ...patchCase(id, { bin: after.bin, layout: after.layout })(c), preview: after.preview };
};

export const patchCaseLayout = (id, patch) => (c) => ({
  ...c,
  cases: c.cases.map((x) => (x.id === id ? { ...x, layout: { ...x.layout, ...patch } } : x)),
});

/** Sets how many of one model a case holds, limited to what is owned and not stored elsewhere. */
export const setItemCount = (caseId, unitId, modelId, count) => (c) => {
  const model = c.units.find((u) => u.id === unitId)?.models.find((m) => m.id === modelId);
  if (!model) return c;
  const max = model.count - assignedCount(c, unitId, modelId, caseId);
  const next = Math.max(0, Math.min(max, Math.round(count)));
  const same = (i) => i.unitId === unitId && i.modelId === modelId;
  return {
    ...c,
    cases: c.cases.map((x) => {
      if (x.id !== caseId) return x;
      if (next === 0) return { ...x, items: x.items.filter((i) => !same(i)) };
      const items = [...x.items];
      const existing = items.findIndex(same);
      if (existing >= 0) items[existing] = { unitId, modelId, count: next };
      else items.push({ unitId, modelId, count: next });
      return { ...x, items };
    }),
  };
};

/** Moves every waiting miniature of a unit into a case: of one model, or without `modelId` of all its models. */
export const assignRemaining = (caseId, unitId, modelId) => (c) => {
  const unit = c.units.find((u) => u.id === unitId);
  const target = c.cases.find((x) => x.id === caseId);
  if (!unit || !target) return c;
  return unit.models
    .filter((m) => modelId === undefined || m.id === modelId)
    .reduce((acc, m) => {
      const current = itemCount(acc.cases.find((x) => x.id === caseId), unitId, m.id);
      return setItemCount(caseId, unitId, m.id, current + m.count - assignedCount(acc, unitId, m.id))(acc);
    }, c);
};

// --- Sorting miniatures into cases. ---

const fits = (plan) => !plan.warnings.some((w) => w.severity === 'error');
const volume = (plan) => plan.unitsX * plan.unitsY * plan.heightUnits;
function footprintArea(m) {
  const { x0, x1, y0, y1 } = reachBox(m, DEFAULT_LAYOUT);
  return (x1 - x0) * (y1 - y0);
}
const NEW_CASE_PENALTY = 8; // grid cells × height units
// In "size" mode, models share a case only when they need about the same bin height.
const SIZE_TOLERANCE_UNITS = 1;

/** The case's plan with extra miniatures added; `parcel` lists { unitId, modelId, count }. */
function planWith(collection, c, parcel) {
  let trial = { ...collection, cases: [c] };
  for (const p of parcel) {
    trial = setItemCount(c.id, p.unitId, p.modelId, itemCount(trial.cases[0], p.unitId, p.modelId) + p.count)(trial);
  }
  return planProject(caseProject(trial, trial.cases[0]));
}

const withCount = (line, count) => [{ ...line, count }];

/** Most miniatures of one model (up to `wanted`) the case can take while everything still fits. */
function maxTake(collection, c, line, wanted, accepts) {
  const ok = (n) => {
    const plan = planWith(collection, c, withCount(line, n));
    return fits(plan) && accepts(c, plan);
  };
  if (!ok(1)) return 0;
  let lo = 1;
  let hi = wanted;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ok(mid)) lo = mid; else hi = mid - 1;
  }
  return lo;
}

function addParcel(collection, caseId, parcel) {
  return parcel.reduce((acc, p) => {
    const current = itemCount(acc.cases.find((x) => x.id === caseId), p.unitId, p.modelId);
    return setItemCount(caseId, p.unitId, p.modelId, current + p.count)(acc);
  }, collection);
}

/**
 * Puts a whole parcel into the case where it adds the least bin volume, or into a new
 * case when that is clearly better. Returns null when no case can take all of it.
 */
function placeWhole(collection, parcel, accepts) {
  let best = null;
  for (const c of collection.cases) {
    const plan = planWith(collection, c, parcel);
    if (!fits(plan) || !accepts(c, plan)) continue;
    const cost = volume(plan) - volume(planProject(caseProject(collection, c)));
    if (!best || cost < best.cost) best = { caseId: c.id, cost };
  }
  const fresh = makeCase(collection);
  const freshPlan = planWith(collection, fresh, parcel);
  if (fits(freshPlan)) {
    // A new case costs its whole volume plus a penalty worth about one grid cell,
    // so sharing a case wins unless it wastes clearly more space.
    const cost = volume(freshPlan) + NEW_CASE_PENALTY;
    if (!best || cost < best.cost) return addParcel(addCase(fresh)(collection), fresh.id, parcel);
  }
  return best ? addParcel(collection, best.caseId, parcel) : null;
}

/**
 * Places the waiting miniatures of one model. With `split`, any case takes as many as
 * fit; otherwise the model stays in one case and is only split across new cases when
 * it cannot fit a single case at all. Whatever fits nowhere stays on the shelf.
 */
function placeLine(collection, line, split, accepts) {
  let next = collection;
  let remaining = line.count;
  let guard = 0;
  while (remaining > 0 && guard++ < 100) {
    if (!split) {
      const whole = placeWhole(next, withCount(line, remaining), accepts);
      if (whole) return whole;
    }

    let best = null;
    if (split) {
      for (const c of next.cases) {
        const take = maxTake(next, c, line, remaining, accepts);
        if (!take) continue;
        const cost = volume(planWith(next, c, withCount(line, take))) - volume(planProject(caseProject(next, c)));
        if (!best || cost < best.cost || (cost === best.cost && take > best.take)) best = { caseId: c.id, take, cost };
      }
    }
    const fresh = makeCase(next);
    const freshTake = maxTake(next, fresh, line, remaining, () => true);
    if (freshTake) {
      const cost = volume(planWith(next, fresh, withCount(line, freshTake))) + NEW_CASE_PENALTY;
      if (!best || cost < best.cost) {
        next = addParcel(addCase(fresh)(next), fresh.id, withCount(line, freshTake));
        remaining -= freshTake;
        continue;
      }
    }
    if (!best) break;
    next = addParcel(next, best.caseId, withCount(line, best.take));
    remaining -= best.take;
  }
  return next;
}

/**
 * Places everything on the shelf into cases, largest bases first, following the
 * collection's sort mode (see SORT_MODES). Each step picks whatever adds the least
 * bin volume: joining an existing case (which may grow) or starting a new one.
 * Bases too big for any case stay on the shelf.
 */
export function distribute(collection) {
  let next = clampAssignments(collection);
  const mode = SORT_MODES.includes(next.sortMode) ? next.sortMode : 'units';
  const lineOf = ({ unit, model, count }) => ({ unitId: unit.id, modelId: model.id, count });
  const bySize = (a, b) => footprintArea(b.model) - footprintArea(a.model) || b.model.heightMm - a.model.heightMm;
  const any = () => true;

  if (mode === 'units') {
    const units = waitingUnits(next)
      .map((w) => ({ ...w, models: [...w.models].sort(bySize) }))
      .sort((a, b) => bySize(a.models[0], b.models[0]));
    for (const { models } of units) {
      const whole = models.length > 1 ? placeWhole(next, models.map(lineOf), any) : null;
      if (whole) {
        next = whole;
        continue;
      }
      for (const entry of models) next = placeLine(next, lineOf(entry), false, any);
    }
    return next;
  }

  const lines = unassigned(next).sort(bySize);
  if (mode === 'fill') {
    for (const entry of lines) next = placeLine(next, lineOf(entry), true, any);
    return next;
  }

  // size: a model only joins a case whose height suits it, so big and small models stay apart.
  for (const entry of lines) {
    const line = lineOf(entry);
    const alone = planWith(next, makeCase(next), withCount(line, 1)).heightUnits;
    const accepts = (c, plan) => {
      if (!c.items.length) return true;
      const before = planProject(caseProject(next, c)).heightUnits;
      return plan.heightUnits - before <= SIZE_TOLERANCE_UNITS && plan.heightUnits - alone <= SIZE_TOLERANCE_UNITS;
    };
    next = placeLine(next, line, false, accepts);
  }
  return next;
}

/** Where a unit's miniatures are: one entry per case holding some. */
export function unitPlacement(collection, unitId) {
  return collection.cases
    .map((c) => ({ case: c, count: c.items.filter((i) => i.unitId === unitId).reduce((n, i) => n + i.count, 0) }))
    .filter((e) => e.count > 0);
}

/** Short status of a planned case for badges: kind is empty, error, warning or ok. */
export function caseStatus(plan) {
  const minis = plan.strips.reduce((n, s) => n + s.group.count, 0);
  const pockets = plan.strips.reduce((n, s) => n + s.capacity, 0);
  if (minis === 0) return { kind: 'empty', label: 'Empty', minis, pockets };
  if (plan.warnings.some((w) => w.severity === 'error')) return { kind: 'error', label: 'Does not fit', minis, pockets };
  if (plan.warnings.length) {
    const label = plan.warnings.some((w) => w.id.startsWith('tall-')) ? 'Too low' : 'Check settings';
    return { kind: 'warning', label, minis, pockets };
  }
  const spare = pockets - minis;
  return { kind: 'ok', label: spare > 0 ? `${spare} spare` : 'Full', minis, pockets };
}
