import { Mesh } from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

export function slugify(name) {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'design';
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads a mesh's geometry as binary STL (model coordinates, Z up). */
export function downloadStl(mesh, filename) {
  if (!mesh?.geometry) return false;
  const stl = new STLExporter().parse(new Mesh(mesh.geometry), { binary: true });
  downloadBlob(new Blob([stl], { type: 'model/stl' }), filename);
  return true;
}
