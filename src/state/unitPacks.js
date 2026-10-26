import { parseUnitPack } from '../model/unitPacks';

/**
 * Unit libraries loaded by the person, kept in this browser's local storage. A pack
 * loaded by URL remembers the URL so it can be fetched again for updates.
 */
const PACKS_KEY = 'ministoregen.unitPacks';
export const MAX_PACK_BYTES = 2_000_000;

function read() {
  try {
    const raw = window.localStorage.getItem(PACKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries) {
  try {
    window.localStorage.setItem(PACKS_KEY, JSON.stringify(entries));
  } catch {
    // Storage can be unavailable or full; the pack then lasts for this visit.
  }
}

const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Stored packs, repaired; entries that no longer parse are left out. */
export function listUnitPacks() {
  return read().flatMap((e) => {
    try {
      return [{ id: String(e.id), url: typeof e.url === 'string' ? e.url : '', pack: parseUnitPack(e.pack) }];
    } catch {
      return [];
    }
  });
}

/** Stores a parsed pack. A pack from the same URL, or with the same name from a file, is replaced. */
export function saveUnitPack(pack, url = '') {
  const entries = read();
  const index = entries.findIndex((e) => (url ? e.url === url : !e.url && e.pack?.name === pack.name));
  const entry = { id: index >= 0 ? entries[index].id : newId(), url, pack };
  if (index >= 0) entries[index] = entry; else entries.push(entry);
  write(entries);
  return entry;
}

export function deleteUnitPack(id) {
  write(read().filter((e) => e.id !== id));
}

/** Parses pack text after checking its size. */
export function readUnitPackText(text) {
  if (text.length > MAX_PACK_BYTES) throw new Error('This unit library is too large (over 2 MB).');
  return parseUnitPack(text);
}

/** Fetches and parses a pack. The server has to allow cross-origin requests (GitHub raw files do). */
export async function fetchUnitPack(url, fetcher = fetch) {
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error('That is not a valid web address.');
  }
  if (parsed.protocol !== 'https:') throw new Error('Unit libraries have to be loaded over https.');
  let response;
  try {
    response = await fetcher(parsed.href, { credentials: 'omit', cache: 'no-cache' });
  } catch {
    throw new Error('Could not reach that address. The server may not allow loading from other sites.');
  }
  if (!response.ok) throw new Error(`The server answered with an error (${response.status}).`);
  return readUnitPackText(await response.text());
}
