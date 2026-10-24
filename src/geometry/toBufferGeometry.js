import { BufferAttribute, BufferGeometry } from 'three';

/** Converts a Manifold into a flat-shaded three.js geometry. */
export function toBufferGeometry(manifold) {
  const mesh = manifold.getMesh();
  const indexed = new BufferGeometry();
  indexed.setAttribute('position', new BufferAttribute(mesh.vertProperties, mesh.numProp));
  indexed.setIndex(new BufferAttribute(mesh.triVerts, 1));
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.computeVertexNormals();
  return geometry;
}
