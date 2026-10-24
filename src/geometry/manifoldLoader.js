import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { useEffect, useState } from 'react';

let modulePromise;

/** Loads and initialises manifold-3d once per page. */
export function loadManifold() {
  if (!modulePromise) {
    modulePromise = Module({ locateFile: () => wasmUrl }).then((wasm) => {
      wasm.setup();
      return wasm;
    });
  }
  return modulePromise;
}

/** Returns the manifold-3d module, or null while it is still loading. */
export function useManifold() {
  const [wasm, setWasm] = useState(null);
  useEffect(() => {
    let active = true;
    loadManifold().then((loaded) => { if (active) setWasm(loaded); });
    return () => { active = false; };
  }, []);
  return wasm;
}
