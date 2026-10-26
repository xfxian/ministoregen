import { useEffect } from 'react';
import { makeDefaultProject, normalizeProject } from '../model/project';
import { binHash } from './shareLink';
import { useHistory } from './useHistory';

const STORAGE_KEY = 'ministoregen.project';

function loadInitialProject(shared) {
  if (typeof window === 'undefined') return makeDefaultProject();
  const local = readStored();
  // A shared link carries no preview settings; keep the viewer's own.
  if (shared) return local ? { ...shared, preview: local.preview } : shared;
  return local ?? makeDefaultProject();
}

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeProject(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * The single-bin design with undo/redo, saved to local storage. While `active`, it is
 * mirrored into the URL hash so a reload or a copied link restores it. `shared` is a
 * project from a share link, opened instead of the stored one.
 */
export function useProject(active = true, shared = null) {
  const history = useHistory(() => loadInitialProject(shared));
  const project = history.value;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      } catch {
        // Storage can be unavailable (private mode); the URL still carries the project.
      }
      if (!active) return;
      const hash = await binHash(project);
      if (!cancelled) window.history.replaceState(null, '', hash);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [project, active]);

  return { ...history, project };
}
