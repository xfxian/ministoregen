import { useEffect } from 'react';
import { makeDefaultCollection, normalizeCollection } from '../model/collection';
import { useHistory } from './useHistory';

export const COLLECTION_KEY = 'ministoregen.collection';

export function readCollection() {
  try {
    const raw = window.localStorage.getItem(COLLECTION_KEY);
    return raw ? normalizeCollection(JSON.parse(raw)) : makeDefaultCollection();
  } catch {
    return makeDefaultCollection();
  }
}

/** The collection with undo/redo, kept in this browser's local storage. */
export function useCollection() {
  const history = useHistory(readCollection);
  const collection = history.value;

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
      } catch {
        // Storage can be unavailable (private mode); the collection then lasts for this visit.
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [collection]);

  return { ...history, collection };
}
