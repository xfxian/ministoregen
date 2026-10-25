import {
  FOOT_HEIGHT, HEIGHT_UNIT, LIP_HEIGHT, cavityBottom, maxWall, minBodyHeight, outerSize, throatSize,
} from '../geometry/gridfinity';
import { LID_SNAP_DROP, lidHeight } from '../geometry/lid';
import {
  evenOverhang, hasOverhang, lattices, normalizeOverhang, reachBox, turnOverhang,
} from './reach';
import { nestGroups } from './nest';

/** When bins stack, the upper bin's feet reach this far below the lower bin's lip base. */
export const STACKED_FOOT_DROP = FOOT_HEIGHT - LIP_HEIGHT;

/** The same group with its base turned by 90° (counter-clockwise, like placeOutline). */
function turned(group) {
  return { ...group, sizeX: group.sizeY, sizeY: group.sizeX, overhang: turnOverhang(normalizeOverhang(group.overhang)) };
}

/** Orientations worth trying: a round or square base reaching equally far on every side looks the same either way. */
function orientations(group) {
  return group.sizeX === group.sizeY && evenOverhang(normalizeOverhang(group.overhang)) ? [false] : [false, true];
}

const oriented = (group, rotated) => (rotated ? turned(group) : group);

/**
 * Pocket centres for one group inside a `width` × `stripLength` rectangle centred on
 * (centerX, centerY). Tries a straight grid and rows shifted against each other (for
 * round bases, a hex pattern) and keeps whichever holds more. What a model reaches past
 * its base stays inside the rectangle too.
 */
export function layoutStrip(group, layout, stripLength, width, centerY = 0, centerX = 0) {
  const candidates = lattices(group, layout).map((p) => arrange(p, stripLength, width, centerX, centerY));
  return candidates.reduce((best, c) => (c.length > best.length ? c : best), []);
}

function countFit(size, pitch, available) {
  return available + 1e-9 < size ? 0 : Math.floor((available - size + 1e-9) / pitch) + 1;
}

function arrange({ colStep, shift, rowStep, box }, stripLength, width, centerX, centerY) {
  const boxWidth = box.x1 - box.x0;
  const rows = countFit(box.y1 - box.y0, rowStep, stripLength);
  const raw = [];
  for (let r = 0; r < rows; r++) {
    // Each row starts as far left as its shift allows.
    const offset = Math.max(0, r * shift - colStep * Math.floor((r * shift) / colStep + 1e-9));
    const cols = countFit(boxWidth, colStep, width - offset);
    for (let c = 0; c < cols; c++) raw.push([offset + c * colStep, r * rowStep]);
  }
  if (!raw.length) return [];
  // Centre what the whole pattern reaches, not just the pocket centres.
  const xs = raw.map(([x]) => x);
  const ys = raw.map(([, y]) => y);
  const dx = centerX - (Math.min(...xs) + box.x0 + Math.max(...xs) + box.x1) / 2;
  const dy = centerY - (Math.min(...ys) + box.y0 + Math.max(...ys) + box.y1) / 2;
  return raw.map(([x, y]) => [x + dx, y + dy]);
}

function fitCount(group, layout, width, length) {
  return layoutStrip(group, layout, length, width).length;
}

/**
 * Shortest strip that holds `count` pockets at the given width, or Infinity.
 * The length includes one spacing gap towards the next strip.
 */
export function minStripLength(group, layout, width, count = group.count) {
  let best = Infinity;
  for (const p of lattices(group, layout)) {
    for (let rows = 1; rows <= 500; rows++) {
      const length = (rows - 1) * p.rowStep + p.box.y1 - p.box.y0 + layout.spacing;
      if (length >= best) break;
      if (arrange(p, length, width, 0, 0).length >= count) {
        best = length;
        break;
      }
      if (rows === 1 && arrange(p, length, width, 0, 0).length === 0) break;
    }
  }
  return best;
}

/** Narrowest width up to `maxWidth` that holds `count` pockets in a strip of `length`. */
function minBlockWidth(group, layout, length, count, maxWidth) {
  let lo = 0;
  let hi = maxWidth;
  for (let i = 0; i < 40 && hi - lo > 0.005; i++) {
    const mid = (lo + hi) / 2;
    if (fitCount(group, layout, mid, length) >= count) hi = mid;
    else lo = mid;
  }
  return hi;
}

function largestSide(group, layout) {
  const { x0, x1, y0, y1 } = reachBox(group, layout);
  return Math.max(x1 - x0, y1 - y0);
}

/**
 * Packs every group into a `width` × `length` area in shelves: each shelf runs across
 * the full width, and blocks of pockets sit side by side in it. Large bases go first;
 * smaller ones fill the room left next to them, turned by 90° where that fits more.
 * A group that runs out of room keeps as many pockets as fit.
 */
function packArea(groups, layout, width, length) {
  const order = groups.map((_, i) => i).sort((a, b) => largestSide(groups[b], layout) - largestSide(groups[a], layout) || a - b);
  const shelves = [];
  const placed = groups.map(() => 0);
  let usedLength = 0;

  for (const gi of order) {
    const group = groups[gi];
    let left = group.count;

    // Room left next to blocks in shelves that already exist.
    for (const shelf of shelves) {
      if (left <= 0) break;
      const free = width - shelf.used - layout.spacing;
      if (free <= 0) continue;
      let best = null;
      for (const rotated of orientations(group)) {
        const k = Math.min(left, fitCount(oriented(group, rotated), layout, free, shelf.length));
        if (k > 0 && (!best || k > best.k)) best = { rotated, k };
      }
      if (!best) continue;
      const w = minBlockWidth(oriented(group, best.rotated), layout, shelf.length, best.k, free);
      shelf.blocks.push({ gi, rotated: best.rotated, k: best.k, width: w });
      shelf.used += layout.spacing + w;
      left -= best.k;
    }

    // New shelves for the rest.
    while (left > 0) {
      const room = length - usedLength;
      let best = null;
      for (const rotated of orientations(group)) {
        const og = oriented(group, rotated);
        const full = minStripLength(og, layout, width, left);
        let option = null;
        if (full <= room + 1e-9) {
          option = { rotated, k: left, length: full };
        } else {
          const k = fitCount(og, layout, width, room);
          if (k > 0) option = { rotated, k, length: minStripLength(og, layout, width, k) };
        }
        if (option && (!best || option.k > best.k || (option.k === best.k && option.length < best.length))) best = option;
      }
      if (!best) break;
      const w = minBlockWidth(oriented(group, best.rotated), layout, best.length, best.k, width);
      shelves.push({ length: best.length, used: w, blocks: [{ gi, rotated: best.rotated, k: best.k, width: w }] });
      usedLength += best.length;
      left -= best.k;
    }
    placed[gi] = group.count - left;
  }
  return { shelves, placed, usedLength, fits: placed.every((n, i) => n >= groups[i].count) };
}

/**
 * Turns packed shelves into pocket positions. Leftover room is shared out between
 * shelves and blocks, which can add spare pockets. Each group lists the pockets it
 * needs first, then its spares; a position is [x, y, quarter turns].
 */
function placePockets(groups, layout, packed, width, length) {
  const real = groups.map(() => []);
  const spare = groups.map(() => []);
  const scaleL = packed.usedLength > 0 ? length / packed.usedLength : 1;
  let y = -length / 2;
  for (const shelf of packed.shelves) {
    const shelfLength = shelf.length * scaleL;
    const blockSum = shelf.blocks.reduce((n, b) => n + b.width, 0);
    const extra = width - shelf.used;
    let x = -width / 2;
    for (const block of shelf.blocks) {
      const w = block.width + (extra * block.width) / blockSum;
      const og = oriented(groups[block.gi], block.rotated);
      const positions = layoutStrip(og, layout, shelfLength, w, y + shelfLength / 2, x + w / 2)
        .map(([px, py]) => [px, py, block.rotated ? 1 : 0]);
      real[block.gi].push(...positions.slice(0, block.k));
      spare[block.gi].push(...positions.slice(block.k));
      x += w + layout.spacing;
    }
    y += shelfLength;
  }
  return groups.map((_, i) => [...real[i], ...spare[i]]);
}

/** Free placement pays off for mixed models and for models that reach further one way than another. */
function nestable(groups) {
  return groups.length > 1 || groups.some((g) => !evenOverhang(normalizeOverhang(g.overhang)));
}

/**
 * Pocket positions for every group in a `width` × `length` area: shelves of tidy rows
 * first, and free placement (nest.js) when the rows do not fit everything. When nothing
 * fits all of them, the rows keep as many as they can.
 */
function packInto(groups, layout, width, length) {
  const packed = packArea(groups, layout, width, length);
  if (!packed.fits && nestable(groups)) {
    const nested = nestGroups(groups, layout, width, length);
    if (nested) return { fits: true, positions: nested };
  }
  return { fits: packed.fits, positions: placePockets(groups, layout, packed, width, length) };
}

/** The wall the shell actually builds: never thicker than the lip is deep. */
function wallOf(bin) {
  return Math.min(bin.wall, maxWall(bin));
}

/**
 * Size of the area pockets are laid out in, along one axis:
 * the drop-in inlay (which must pass the stacking lip opening), or the bin floor.
 */
function areaSize(units, bin, layout) {
  return layout.pocketMode === 'floor'
    ? outerSize(units) - 2 * wallOf(bin)
    : throatSize(units) - layout.inlayClearance;
}

function usableSize(units, bin, layout) {
  return areaSize(units, bin, layout) - 2 * layout.margin;
}

/**
 * How much a footprint costs when choosing among bins that fit: its grid cells, plus a
 * penalty for long thin bins, which waste room in a drawer and print fragile walls.
 */
export function footprintCost(unitsX, unitsY) {
  const aspect = Math.max(unitsX, unitsY) / Math.min(unitsX, unitsY);
  return unitsX * unitsY + 0.5 * Math.max(0, aspect - 2);
}

/**
 * Footprints that hold every group, cheapest first (see footprintCost): squarer before
 * longer, and longer than wide before wider than long.
 */
function* fittingFootprints(groups, bin, layout) {
  // Models never overlap, so the bin needs at least the area they reach over.
  const pocketArea = groups.reduce((n, g) => n + g.count * lattices(g, layout)[0].area, 0);
  const candidates = [];
  for (let ux = 1; ux <= bin.maxUnits; ux++) {
    for (let uy = 1; uy <= bin.maxUnits; uy++) {
      candidates.push({ unitsX: ux, unitsY: uy, score: [footprintCost(ux, uy), Math.abs(ux - uy), ux > uy ? 1 : 0] });
    }
  }
  candidates.sort((a, b) => compare(a.score, b.score));
  for (const c of candidates) {
    const w = usableSize(c.unitsX, bin, layout);
    const l = usableSize(c.unitsY, bin, layout);
    if (w * l < pocketArea) continue;
    if (packArea(groups, layout, w, l).fits || (nestable(groups) && nestGroups(groups, layout, w, l))) {
      yield { unitsX: c.unitsX, unitsY: c.unitsY, cost: c.score[0] };
    }
  }
}

function chooseFootprint(groups, bin, layout) {
  if (!bin.autoFootprint) return { unitsX: bin.unitsX, unitsY: bin.unitsY, fitsOneBin: true };
  const { value } = fittingFootprints(groups, bin, layout).next();
  return value
    ? { unitsX: value.unitsX, unitsY: value.unitsY, fitsOneBin: true }
    : { unitsX: bin.maxUnits, unitsY: bin.maxUnits, fitsOneBin: false };
}

/**
 * Bin sizes worth offering for the project's miniatures: the one the planner picks
 * on its own, then up to `max` − 1 other sizes that fit everything and cost at most
 * half as much again. The same size turned by 90° is left out. Each option has its
 * own plan, laid out for a bin fixed at that size.
 */
export function layoutOptions(project, max = 4) {
  const { groups, bin, layout } = project;
  if (!groups.length) return [];
  const options = [];
  let limit = Infinity;
  for (const f of fittingFootprints(groups, bin, layout)) {
    if (f.cost > limit || options.length >= max) break;
    if (options.some((o) => o.unitsX === f.unitsY && o.unitsY === f.unitsX)) continue;
    if (!options.length) limit = f.cost * 1.5;
    const fixed = { ...project, bin: { ...bin, autoFootprint: false, unitsX: f.unitsX, unitsY: f.unitsY } };
    options.push({ unitsX: f.unitsX, unitsY: f.unitsY, project: fixed, plan: planProject(fixed) });
  }
  return options;
}

function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/**
 * Derives everything the app shows and exports from the project: bin size and
 * height, inlay size, pocket positions per group, and warnings with suggested fixes.
 */
export function planProject(project) {
  const { groups, bin, layout } = project;
  const warnings = [];
  const { unitsX, unitsY, fitsOneBin } = groups.length
    ? chooseFootprint(groups, bin, layout)
    : { unitsX: bin.autoFootprint ? 1 : bin.unitsX, unitsY: bin.autoFootprint ? 1 : bin.unitsY, fitsOneBin: true };

  if (!fitsOneBin) {
    warnings.push({
      id: 'too-big',
      severity: 'error',
      text: `This collection does not fit in one bin up to ${bin.maxUnits} × ${bin.maxUnits} units. Split it into several projects or allow larger bins.`,
      fix: { label: `Allow up to ${bin.maxUnits + 2} units`, bin: { maxUnits: bin.maxUnits + 2 } },
    });
  }

  const area = { width: areaSize(unitsX, bin, layout), length: areaSize(unitsY, bin, layout) };
  const inlay = layout.pocketMode === 'inlay'
    ? { ...area, depth: layout.inlayDepth, cornerRadius: layout.inlayCornerRadius }
    : null;
  const usableW = area.width - 2 * layout.margin;
  const usableL = area.length - 2 * layout.margin;

  const placements = packInto(groups, layout, usableW, usableL).positions;
  const strips = groups.map((group, i) => ({ group, positions: placements[i], capacity: placements[i].length }));

  strips.forEach(({ group, capacity }) => {
    const fitsAtAll = orientations(group).some((r) => fitCount(oriented(group, r), layout, usableW, usableL) > 0);
    if (!fitsAtAll) {
      warnings.push({
        id: `wide-${group.id}`,
        severity: 'error',
        groupId: group.id,
        text: `${group.name}: a ${group.sizeX} × ${group.sizeY} mm base${hasOverhang(normalizeOverhang(group.overhang)) ? ' with its overhang' : ''} does not fit in this bin.`,
        fix: bin.autoFootprint ? undefined : { label: 'Size the bin automatically', bin: { autoFootprint: true } },
      });
    } else if (capacity < group.count) {
      warnings.push({
        id: `count-${group.id}`,
        severity: 'error',
        groupId: group.id,
        text: `${group.name}: only ${capacity} of ${group.count} fit.`,
        fix: bin.autoFootprint ? undefined : { label: 'Size the bin automatically', bin: { autoFootprint: true } },
      });
    }
  });

  const floorZ = cavityBottom({ feet: bin.feet, floor: bin.floor });
  const lid = bin.lip && bin.lid !== 'none' ? { style: bin.lid, snap: bin.lidSnap } : null;
  if (lid) lid.height = lidHeight(lid);
  if (!bin.lip && bin.lid !== 'none') {
    warnings.push({
      id: 'lid-needs-lip',
      severity: 'warning',
      text: 'Lids sit in the stacking lip, so this bin gets no lid.',
      fix: { label: 'Add the stacking lip', bin: { lip: true } },
    });
  }
  // Whatever sits in the lip on top (a stacked bin, a lid, or a lid's snap clips) reaches this far down.
  const drop = !bin.lip ? 0 : lid?.snap ? LID_SNAP_DROP : STACKED_FOOT_DROP;
  const tallest = groups.reduce((m, g) => Math.max(m, g.heightMm), 0);
  const minHeight = minBodyHeight({ feet: bin.feet, floor: bin.floor, wall: wallOf(bin), lip: bin.lip });
  const neededHeight = Math.max(floorZ + tallest + drop, minHeight);
  const neededUnits = Math.ceil(neededHeight / HEIGHT_UNIT - 1e-9);
  const heightUnits = bin.autoHeight ? neededUnits : bin.heightUnits;
  const heightMm = Math.max(heightUnits * HEIGHT_UNIT, minHeight);

  groups.forEach((g) => {
    const over = floorZ + g.heightMm + drop - heightMm;
    if (over > 1e-6) {
      warnings.push({
        id: `tall-${g.id}`,
        severity: 'warning',
        groupId: g.id,
        text: `${g.name} is ${over.toFixed(1)} mm taller than the bin${!bin.lip ? '' : lid ? ' with the lid on' : ' when bins are stacked'}.`,
        fix: { label: `Raise to ${neededUnits}u`, bin: { autoHeight: false, heightUnits: neededUnits } },
      });
    }
  });

  return { unitsX, unitsY, heightUnits, heightMm, area, inlay, lid, strips, warnings, floorZ };
}
