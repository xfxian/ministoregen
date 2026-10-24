// Small immutable update helpers for the project.

export const setName = (name) => (p) => ({ ...p, name });
export const patchBin = (patch) => (p) => ({ ...p, bin: { ...p.bin, ...patch } });
export const patchLayout = (patch) => (p) => ({ ...p, layout: { ...p.layout, ...patch } });
export const patchPreview = (patch) => (p) => ({ ...p, preview: { ...p.preview, ...patch } });
export const addGroup = (group) => (p) => ({ ...p, groups: [...p.groups, group] });
export const removeGroup = (id) => (p) => ({ ...p, groups: p.groups.filter((g) => g.id !== id) });
export const patchGroup = (id, patch) => (p) => ({
  ...p,
  groups: p.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
});
export const moveGroup = (id, delta) => (p) => {
  const i = p.groups.findIndex((g) => g.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= p.groups.length) return p;
  const groups = [...p.groups];
  [groups[i], groups[j]] = [groups[j], groups[i]];
  return { ...p, groups };
};
