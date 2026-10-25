import { useCallback, useRef, useState } from 'react';

const HISTORY_LIMIT = 100;

/**
 * State with undo and redo. `update` takes a new value or a function of the current
 * one; rapid edits (typing, holding a stepper) are merged into one undo step. Pass
 * `{ commit: true }` for discrete actions (delete, sort) so they always get their own step.
 */
export function useHistory(initial) {
  const [state, setState] = useState(() => ({ past: [], present: typeof initial === 'function' ? initial() : initial, future: [] }));
  const lastCommit = useRef(0);

  const update = useCallback((recipe, { commit = false } = {}) => {
    setState(({ past, present, future }) => {
      const next = typeof recipe === 'function' ? recipe(present) : recipe;
      if (next === present) return { past, present, future };
      const now = Date.now();
      const merge = !commit && now - lastCommit.current < 600 && past.length > 0;
      // After a discrete action the next edit starts a fresh step too.
      lastCommit.current = commit ? 0 : now;
      return {
        past: merge ? past : [...past, present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);

  /** Replaces the value and starts a new undo step right away (opening a design, say). */
  const replace = useCallback((value) => {
    lastCommit.current = 0;
    setState(({ past, present }) => ({ past: [...past, present].slice(-HISTORY_LIMIT), present: value, future: [] }));
  }, []);

  const undo = useCallback(() => setState(({ past, present, future }) => (past.length
    ? { past: past.slice(0, -1), present: past.at(-1), future: [present, ...future] }
    : { past, present, future })), []);

  const redo = useCallback(() => setState(({ past, present, future }) => (future.length
    ? { past: [...past, present], present: future[0], future: future.slice(1) }
    : { past, present, future })), []);

  return {
    value: state.present,
    update,
    replace,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
