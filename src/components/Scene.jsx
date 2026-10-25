import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LID_SNAP_DROP } from '../geometry/lid';
import { buildBinPart, buildInlayPart, buildLidPart } from '../geometry/parts';
import { STACKED_FOOT_DROP } from '../model/layout';
import { toBufferGeometry } from '../geometry/toBufferGeometry';
import { placeOutline, pocketOutline } from '../model/pockets';

// Keeps the left half of the model when the cut view is on, exposing the wall profile.
const CUT_PLANE = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

/**
 * Builds a part with manifold-3d and converts it for three.js. `key` captures every
 * input of `build`, so the part is only rebuilt when something relevant changed.
 */
function useManifoldGeometry(wasm, build, key) {
  const geometry = useMemo(() => {
    if (!wasm) return null;
    const manifold = build();
    if (!manifold) return null;
    const result = toBufferGeometry(manifold);
    manifold.delete();
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wasm, key]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
}

function Part({ geometry, color, opacity, wireframe, cut, z = 0 }) {
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} position={[0, 0, z]}>
      <meshStandardMaterial
        color={color}
        roughness={0.55}
        metalness={0.05}
        wireframe={wireframe}
        transparent={opacity < 1}
        opacity={opacity}
        side={cut ? THREE.DoubleSide : THREE.FrontSide}
        clippingPlanes={cut ? [CUT_PLANE] : []}
      />
    </mesh>
  );
}

/** Coloured discs on the pocket floors, one colour per group. */
function PocketMarkers({ project, plan, highlightId, cut }) {
  const geometries = useMemo(() => plan.strips.map((s) => {
    if (!s.positions.length) return null;
    const outline = pocketOutline(s.group, project.layout, 48).map(([x, y]) => [x * 0.92, y * 0.92]);
    const parts = s.positions.map((p) => new THREE.ShapeGeometry(new THREE.Shape(placeOutline(outline, p).map(([x, y]) => new THREE.Vector2(x, y)))));
    const merged = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    return { group: s.group, geometry: merged, dispose: () => merged.dispose() };
  }).filter(Boolean), [plan, project.layout]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  return geometries.map(({ group, geometry }) => (
    <mesh key={group.id} geometry={geometry} position={[0, 0, plan.floorZ + 0.05]}>
      <meshBasicMaterial color={group.color} transparent opacity={highlightId && highlightId !== group.id ? 0.25 : 0.9} clippingPlanes={cut ? [CUT_PLANE] : []} />
    </mesh>
  ));
}

/** Translucent stand-ins for the miniatures, to check heights against the bin. */
function MiniGhosts({ plan, highlightId, cut }) {
  const geometries = useMemo(() => plan.strips.map((s) => {
    const placed = s.positions.slice(0, s.group.count);
    if (!placed.length) return null;
    const { sizeX, sizeY, heightMm, shape } = s.group;
    const base = shape === 'square' || shape === 'rect'
      ? new THREE.BoxGeometry(sizeX * 0.9, sizeY * 0.9, heightMm)
      : new THREE.CylinderGeometry(0.45, 0.45, heightMm, 24).rotateX(Math.PI / 2).scale(sizeX, sizeY, 1);
    const merged = mergeGeometries(placed.map(([x, y, rotated]) => {
      const g = base.clone();
      if (rotated) g.rotateZ(Math.PI / 2);
      return g.translate(x, y, heightMm / 2);
    }));
    base.dispose();
    return { group: s.group, geometry: merged, dispose: () => merged.dispose() };
  }).filter(Boolean), [plan]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  return geometries.map(({ group, geometry }) => (
    <mesh key={group.id} geometry={geometry} position={[0, 0, plan.floorZ]}>
      <meshStandardMaterial color={group.color} transparent opacity={highlightId && highlightId !== group.id ? 0.08 : 0.3} depthWrite={false} clippingPlanes={cut ? [CUT_PLANE] : []} />
    </mesh>
  ));
}

/** Everything printable plus preview helpers, in model coordinates (Z up, millimetres). */
function Scene({ wasm, project, plan, view, highlightId }) {
  const { preview } = project;
  const cut = view === 'cut';
  const binKey = JSON.stringify([plan.unitsX, plan.unitsY, plan.heightMm, project.bin, preview.segments,
    project.layout.pocketMode === 'floor' ? [project.layout, plan.strips.map((s) => [s.group, s.positions])] : '']);
  const inlayKey = JSON.stringify([plan.inlay, project.layout, preview.segments,
    plan.strips.map((s) => [s.group.shape, s.group.sizeX, s.group.sizeY, s.positions])]);

  const binGeometry = useManifoldGeometry(wasm, () => buildBinPart(wasm, project, plan), binKey);
  const inlayGeometry = useManifoldGeometry(wasm, () => (plan.inlay ? buildInlayPart(wasm, project, plan) : null), inlayKey);
  const lidKey = JSON.stringify([plan.unitsX, plan.unitsY, plan.lid, preview.segments]);
  const lidGeometry = useManifoldGeometry(wasm, () => buildLidPart(wasm, project, plan), lidKey);
  // Seated in the cut view, to show how it locks in; lifted off otherwise, to show the pockets.
  const lidSeat = plan.lid ? plan.heightMm - (plan.lid.snap ? LID_SNAP_DROP : STACKED_FOOT_DROP) : 0;
  const lidZ = cut ? lidSeat : lidSeat + 18;

  return (
    <group>
      <Part geometry={binGeometry} color={preview.color} opacity={1} wireframe={preview.wireframe} cut={cut} />
      {plan.inlay && (
        <Part geometry={inlayGeometry} color="#d9dde3" opacity={1} wireframe={preview.wireframe} cut={cut} z={plan.floorZ + 0.01} />
      )}
      {plan.lid && preview.showLid && (
        <Part geometry={lidGeometry} color="#c3cad3" opacity={1} wireframe={preview.wireframe} cut={cut} z={lidZ} />
      )}
      <PocketMarkers project={project} plan={plan} highlightId={highlightId} cut={cut} />
      {preview.showMinis && <MiniGhosts plan={plan} highlightId={highlightId} cut={cut} />}
    </group>
  );
}

export default Scene;
