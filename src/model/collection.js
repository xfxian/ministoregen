/**
 * The collection: every unit someone owns, and the cases (bins) they are stored in.
 * A case holds a count per unit; anything not assigned waits on the shelf. Each case
 * turns into an ordinary project (see caseProject), so planning, geometry and export
 * work exactly as for a single bin.
 */
import { planProject } from './layout';
import {
  DEFAULT_BIN, DEFAULT_LAYOUT, DEFAULT_PREVIEW, isObject, makeGroup, normalizeGroup, normalizeSettings,
} from './project';

let nextId = 1;
const newId = (prefix) => `${prefix}${Date.now().toString(36)}${(nextId++).toString(36)}`;

export function makeUnit(index = 0, overrides = {}) {
  return makeGroup(index, { name: `Unit ${index + 1}`, count: 5, ...overrides, id: overrides.id ?? newId('u') });
}

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
  return { version: 1, name: 'My collection', units: [], cases: [], keepTogether: true, preview: { ...DEFAULT_PREVIEW } };
}

/** Repairs a stored or imported collection so it can never break the app. */
export function normalizeCollection(raw) {
  const base = makeDefaultCollection();
  if (!isObject(raw)) return base;
  const units = Array.isArray(raw.units) ? raw.units.filter(isObject).slice(0, 200).map(normalizeGroup) : [];
  const cases = Array.isArray(raw.cases) ? raw.cases.filter(isObject).slice(0, 100).map((c, i) => ({
    id: typeof c.id === 'string' ? c.id : newId('c'),
    name: typeof c.name === 'string' ? c.name.slice(0, 60) : `Case ${i + 1}`,
    bin: normalizeSettings(DEFAULT_BIN, c.bin),
    layout: normalizeSettings(DEFAULT_LAYOUT, c.layout),
    items: Array.isArray(c.items) ? c.items.filter(isObject).map((item) => ({
      unitId: String(item.unitId),
      count: Math.max(0, Math.round(Number(item.count) || 0)),
    })) : [],
  })) : [];
  return clampAssignments({
    version: 1,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : base.name,
    units,
    cases,
    keepTogether: typeof raw.keepTogether === 'boolean' ? raw.keepTogether : base.keepTogether,
    preview: normalizeSettings(DEFAULT_PREVIEW, raw.preview),
  });
}

export function assignedCount(collection, unitId, exceptCaseId) {
  return collection.cases.reduce((n, c) => (c.id === exceptCaseId ? n : n + c.items
    .filter((i) => i.unitId === unitId)
    .reduce((m, i) => m + i.count, 0)), 0);
}

/** Units with miniatures that are not in any case yet, in collection order. */
export function unassigned(collection) {
  return collection.units
    .map((unit) => ({ unit, count: unit.count - assignedCount(collection, unit.id) }))
    .filter((e) => e.count > 0);
}

/** The case as a plain project, ready for planProject and the geometry builders. */
export function caseProject(collection, c, preview = collection.preview ?? DEFAULT_PREVIEW) {
  const byId = new Map(collection.units.map((u) => [u.id, u]));
  const groups = c.items
    .map((i) => {
      const unit = byId.get(i.unitId);
      return unit && i.count > 0 ? { ...unit, count: i.count } : null;
    })
    .filter(Boolean);
  return { version: 1, name: c.name, groups, bin: c.bin, layout: c.layout, preview };
}

/**
 * Keeps assignments consistent: items point at existing units, each unit appears once
 * per case, and no unit is assigned more often than it is owned (later cases give way).
 */
export function clampAssignments(collection) {
  const owned = new Map(collection.units.map((u) => [u.id, u.count]));
  let cases = collection.cases.map((c) => {
    const merged = new Map();
    for (const item of c.items) {
      if (!owned.has(item.unitId) || item.count <= 0) continue;
      merged.set(item.unitId, (merged.get(item.unitId) ?? 0) + item.count);
    }
    return { ...c, items: [...merged].map(([unitId, count]) => ({ unitId, count })) };
  });
  const left = new Map(owned);
  cases = cases.map((c) => ({
    ...c,
    items: c.items
      .map((item) => {
        const count = Math.min(item.count, left.get(item.unitId));
        left.set(item.unitId, left.get(item.unitId) - count);
        return { ...item, count };
      })
      .filter((item) => item.count > 0),
  }));
  const unchanged = cases.every((c, i) => JSON.stringify(c.items) === JSON.stringify(collection.cases[i].items));
  return unchanged ? collection : { ...collection, cases };
}

// --- Updates: each returns a function from collection to collection. ---

export const setCollectionName = (name) => (c) => ({ ...c, name });
export const setKeepTogether = (keepTogether) => (c) => ({ ...c, keepTogether });

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

/** Sets how many of a unit a case holds, limited to what is owned and not stored elsewhere. */
export const setItemCount = (caseId, unitId, count) => (c) => {
  const unit = c.units.find((u) => u.id === unitId);
  if (!unit) return c;
  const max = unit.count - assignedCount(c, unitId, caseId);
  const next = Math.max(0, Math.min(max, Math.round(count)));
  return {
    ...c,
    cases: c.cases.map((x) => {
      if (x.id !== caseId) return x;
      const others = x.items.filter((i) => i.unitId !== unitId);
      const existing = x.items.findIndex((i) => i.unitId === unitId);
      if (next === 0) return { ...x, items: others };
      const items = [...x.items];
      if (existing >= 0) items[existing] = { unitId, count: next };
      else items.push({ unitId, count: next });
      return { ...x, items };
    }),
  };
};

/** Moves every waiting miniature of a unit into a case. */
export const assignRemaining = (caseId, unitId) => (c) => {
  const unit = c.units.find((u) => u.id === unitId);
  const target = c.cases.find((x) => x.id === caseId);
  if (!unit || !target) return c;
  const current = target.items.find((i) => i.unitId === unitId)?.count ?? 0;
  return setItemCount(caseId, unitId, current + unit.count - assignedCount(c, unitId))(c);
};

// --- Sorting miniatures into cases. ---

const fits = (plan) => !plan.warnings.some((w) => w.severity === 'error');
const volume = (plan) => plan.unitsX * plan.unitsY * plan.heightUnits;
const baseArea = (u) => u.sizeX * u.sizeY;
const NEW_CASE_PENALTY = 8; // grid cells × height units

function planWith(collection, c, unit, count) {
  const current = c.items.find((i) => i.unitId === unit.id)?.count ?? 0;
  const trial = setItemCount(c.id, unit.id, current + count)({ ...collection, cases: [c] });
  return planProject(caseProject(trial, trial.cases[0]));
}

/** Most miniatures of `unit` (up to `wanted`) the case can take while everything still fits. */
function maxTake(collection, c, unit, wanted) {
  if (!fits(planWith(collection, c, unit, 1))) return 0;
  let lo = 1;
  let hi = wanted;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(planWith(collection, c, unit, mid))) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/**
 * Places everything on the shelf into cases, largest bases first. Each step picks
 * whatever adds the least bin volume: joining an existing case (which may grow) or
 * starting a new one. With `keepTogether`, a unit is only split across cases when it
 * cannot fit into a single case at all. Bases too big for any case stay on the shelf.
 */
export function distribute(collection) {
  let next = clampAssignments(collection);
  const pending = unassigned(next)
    .sort((a, b) => baseArea(b.unit) - baseArea(a.unit) || b.unit.heightMm - a.unit.heightMm);

  for (const { unit } of pending) {
    let remaining = unit.count - assignedCount(next, unit.id);
    let guard = 0;
    while (remaining > 0 && guard++ < 100) {
      let best = null;
      for (const c of next.cases) {
        const before = planProject(caseProject(next, c));
        const take = next.keepTogether
          ? (fits(planWith(next, c, unit, remaining)) ? remaining : 0)
          : maxTake(next, c, unit, remaining);
        if (!take) continue;
        const cost = volume(planWith(next, c, unit, take)) - volume(before);
        if (!best || cost < best.cost || (cost === best.cost && take > best.take)) best = { caseId: c.id, take, cost };
      }

      const fresh = makeCase(next);
      const freshTake = fits(planWith(next, fresh, unit, remaining)) ? remaining : maxTake(next, fresh, unit, remaining);
      if (freshTake) {
        // A new case costs its whole volume plus a penalty worth about one grid cell,
        // so sharing a case wins unless it wastes clearly more space.
        const cost = volume(planWith(next, fresh, unit, freshTake)) + NEW_CASE_PENALTY;
        const better = !best || cost < best.cost || (next.keepTogether && best.take < remaining && freshTake === remaining);
        if (better) {
          next = setItemCount(fresh.id, unit.id, freshTake)(addCase(fresh)(next));
          remaining -= freshTake;
          continue;
        }
      }
      if (!best) break;
      const current = next.cases.find((c) => c.id === best.caseId).items.find((i) => i.unitId === unit.id)?.count ?? 0;
      next = setItemCount(best.caseId, unit.id, current + best.take)(next);
      remaining -= best.take;
    }
  }
  return next;
}


/** Where a unit's miniatures are: one entry per case holding some. */
export function unitPlacement(collection, unitId) {
  return collection.cases
    .map((c) => ({ case: c, count: c.items.find((i) => i.unitId === unitId)?.count ?? 0 }))
    .filter((e) => e.count > 0);
}

/** Short status of a planned case for badges: kind is empty, error, warning or ok. */
export function caseStatus(plan) {
  const minis = plan.strips.reduce((n, s) => n + s.group.count, 0);
  const pockets = plan.strips.reduce((n, s) => n + s.capacity, 0);
  if (minis === 0) return { kind: 'empty', label: 'Empty', minis, pockets };
  if (plan.warnings.some((w) => w.severity === 'error')) return { kind: 'error', label: 'Does not fit', minis, pockets };
  if (plan.warnings.length) return { kind: 'warning', label: 'Too low', minis, pockets };
  const spare = pockets - minis;
  return { kind: 'ok', label: spare > 0 ? `${spare} spare` : 'Full', minis, pockets };
}
