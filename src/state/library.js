import { normalizeCollection } from '../model/collection';
import { normalizeProject } from '../model/project';
import { parseUnitPack } from '../model/unitPacks';
import { listUnitPacks, saveUnitPack } from './unitPacks';

/**
 * Local design library: saved projects live in the browser's local storage.
 * Export/import as a JSON file covers backups and moving between devices.
 */
const LIBRARY_KEY = 'ministoregen.library';
export const LIBRARY_FILE_FORMAT = 'ministoregen-library';

function read() {
  try {
    const raw = window.localStorage.getItem(LIBRARY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.id === 'string') : [];
  } catch {
    return [];
  }
}

function write(entries) {
  window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(entries));
}

const newId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function listDesigns() {
  return read()
    .map((e) => ({ ...e, project: normalizeProject(e.project) }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

/** Saves the project; updates the entry with `id` when given, otherwise adds a new one. */
export function saveDesign(project, id) {
  const entries = read();
  const entry = { id: id ?? newId(), savedAt: Date.now(), project };
  const index = entries.findIndex((e) => e.id === entry.id);
  if (index >= 0) entries[index] = entry; else entries.push(entry);
  write(entries);
  return entry.id;
}

export function deleteDesign(id) {
  write(read().filter((e) => e.id !== id));
}

// 2: also holds the open single bin and the loaded unit libraries.
const LIBRARY_FILE_VERSION = 2;

/**
 * Backup file with everything this browser keeps: saved single-bin designs, loaded unit
 * libraries and, when given, the collection and the open single bin.
 */
export function exportLibrary(collection, project) {
  const unitPacks = listUnitPacks().map(({ url, pack }) => ({ url, pack }));
  return JSON.stringify({
    format: LIBRARY_FILE_FORMAT, version: LIBRARY_FILE_VERSION, designs: read(), unitPacks, collection, project,
  }, null, 2);
}

/** File name for a backup made on `date`, such as ministoregen-backup-2026-10-26.json. */
export function backupFileName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `ministoregen-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

/**
 * Merges designs and unit libraries from an exported file. Returns how many designs
 * and libraries were added or updated, and the file's collection and single bin (or
 * null) for the caller to adopt.
 */
export function importLibrary(text) {
  const data = JSON.parse(text);
  if (data?.format !== LIBRARY_FILE_FORMAT || !Array.isArray(data.designs)) {
    throw new Error('This file is not a ministoregen library export.');
  }
  const entries = read();
  let count = 0;
  for (const d of data.designs) {
    if (!d || typeof d.id !== 'string') continue;
    const entry = { id: d.id, savedAt: Number(d.savedAt) || Date.now(), project: normalizeProject(d.project) };
    const index = entries.findIndex((e) => e.id === entry.id);
    if (index >= 0) entries[index] = entry; else entries.push(entry);
    count++;
  }
  write(entries);
  let packs = 0;
  for (const entry of Array.isArray(data.unitPacks) ? data.unitPacks : []) {
    try {
      saveUnitPack(parseUnitPack(entry?.pack), typeof entry?.url === 'string' ? entry.url : '');
      packs++;
    } catch {
      // A library that no longer reads is skipped; the rest of the backup still counts.
    }
  }
  return {
    count,
    packs,
    collection: data.collection ? normalizeCollection(data.collection) : null,
    project: data.project ? normalizeProject(data.project) : null,
  };
}
