import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeProject, encodeProject, makeDefaultProject, normalizeProject } from '../model/project';

const STORAGE_KEY = 'ministoregen.project';
const HASH_PREFIX = '#p=';
const HISTORY_LIMIT = 100;

function loadInitialProject() {
  if (typeof window === 'undefined') return makeDefaultProject();
  if (window.location.hash.startsWith(HASH_PREFIX)) {
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
 * Project state with undo/redo, saved to local storage and mirrored into the
 * URL hash so a reload or a copied link restores the same configuration.
 */
export function useProject() {
  const [state, setState] = useState(() => ({ past: [], present: loadInitialProject(), future: [] }));
  const project = state.present;
  const lastCommit = useRef(0);

  const update = useCallback((recipe) => {
    setState(({ past, present }) => {
      const next = typeof recipe === 'function' ? recipe(present) : recipe;
      if (next === present) return { past, present, future: [] };
      // Coalesce rapid edits (typing, holding a stepper) into one undo step.
      const now = Date.now();
      const merge = now - lastCommit.current < 600 && past.length > 0;
      lastCommit.current = now;
      return {
        past: merge ? past : [...past, present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => setState(({ past, present, future }) => (past.length
    ? { past: past.slice(0, -1), present: past.at(-1), future: [present, ...future] }
    : { past, present, future })), []);

  const redo = useCallback(() => setState(({ past, present, future }) => (future.length
    ? { past: [...past, present], present: future[0], future: future.slice(1) }
    : { past, present, future })), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      } catch {
        // Storage can be unavailable (private mode); the URL still carries the project.
      }
      window.history.replaceState(null, '', `${HASH_PREFIX}${encodeProject(project)}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      if (e.target instanceof HTMLElement && e.target.matches('input, textarea')) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return {
    project,
    update,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    reset: () => update(makeDefaultProject()),
  };
}
