import { useEffect } from 'react';
import { decodeProject, encodeProject, makeDefaultProject, normalizeProject } from '../model/project';
import { useHistory } from './useHistory';

const STORAGE_KEY = 'ministoregen.project';
const HASH_PREFIX = '#p=';

/** True when the page was opened from a shared single-bin link. */
export function hasSharedProject() {
  return typeof window !== 'undefined' && window.location.hash.startsWith(HASH_PREFIX);
}

function loadInitialProject() {
  if (typeof window === 'undefined') return makeDefaultProject();
  if (hasSharedProject()) {
    const shared = decodeProject(window.location.hash.slice(HASH_PREFIX.length));
    if (shared) {
      // A shared link carries no preview settings; keep the viewer's own.
      const local = readStored();
      return local ? { ...shared, preview: local.preview } : shared;
    }
  }
  return readStored() ?? makeDefaultProject();
}

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeProject(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function shareUrl(project) {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${HASH_PREFIX}${encodeProject(project)}`;
}

/**
 * The single-bin design with undo/redo, saved to local storage. While `active`, it is
 * mirrored into the URL hash so a reload or a copied link restores it.
 */
export function useProject(active = true) {
  const history = useHistory(loadInitialProject);
  const project = history.value;

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      } catch {
        // Storage can be unavailable (private mode); the URL still carries the project.
      }
      if (active) window.history.replaceState(null, '', `${HASH_PREFIX}${encodeProject(project)}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [project, active]);

  return { ...history, project };
}
