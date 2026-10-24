import { normalizeProject } from '../model/project';

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

export function exportLibrary() {
  return JSON.stringify({ format: LIBRARY_FILE_FORMAT, version: 1, designs: read() }, null, 2);
}

/** Merges designs from an exported file; returns how many were added or updated. */
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
  return count;
}
