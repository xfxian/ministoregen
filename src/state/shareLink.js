import { decodeProject } from '../model/project';
import {
  BIN_HASH, COLLECTION_HASH, LEGACY_BIN_HASH, decodePayload, encodePayload, packCollection, packProject, unpackCollection,
  unpackProject,
} from '../model/share';

/** Links longer than this may be cut off by some chat apps and mail clients. */
export const LONG_LINK = 8000;

/**
 * Reads a share link from a URL hash. Returns { kind: 'collection' | 'bin', value },
 * { error } for a link that cannot be read, or null when the hash is no share link.
 */
export async function readShareLink(hash) {
  const kind = hash.startsWith(COLLECTION_HASH) ? 'collection'
    : hash.startsWith(BIN_HASH) || hash.startsWith(LEGACY_BIN_HASH) ? 'bin' : null;
  if (!kind) return null;
  const payload = hash.slice(hash.indexOf('=') + 1);
  try {
    if (hash.startsWith(LEGACY_BIN_HASH)) {
      const value = decodeProject(payload);
      if (!value) throw new Error();
      return { kind, value };
    }
    const data = await decodePayload(payload);
    return { kind, value: kind === 'collection' ? unpackCollection(data) : unpackProject(data) };
  } catch (e) {
    const newer = e instanceof Error && e.message.includes('newer version');
    return { error: newer ? e.message : 'This link is damaged or incomplete. Ask for a new one.' };
  }
}

const pageUrl = () => {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}`;
};

export async function binHash(project) {
  return `${BIN_HASH}${await encodePayload(packProject(project))}`;
}

export async function binLink(project) {
  return `${pageUrl()}${await binHash(project)}`;
}

export async function collectionLink(collection) {
  return `${pageUrl()}${COLLECTION_HASH}${await encodePayload(packCollection(collection))}`;
}

/**
 * Copies text that is still being built. Safari only allows writing to the clipboard
 * during the click, so the promise goes into the clipboard item where supported.
 * Falls back to a prompt to copy from; resolves to false then.
 */
export async function copyLink(textPromise) {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const blob = textPromise.then((text) => new Blob([text], { type: 'text/plain' }));
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
    } else {
      await navigator.clipboard.writeText(await textPromise);
    }
    return true;
  } catch {
    window.prompt('Copy this link:', await textPromise);
    return false;
  }
}
