import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LID_SNAP_DROP } from '../geometry/lid';
import { buildBinPart, buildInlayPart, buildLidPart } from '../geometry/parts';
import { STACKED_FOOT_DROP } from '../model/layout';
import { toBufferGeometry } from '../geometry/toBufferGeometry';
import { cutOutlines, placeOutline } from '../model/pockets';
import { hasOverhang, normalizeOverhang, reachOutline } from '../model/reach';

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

/** An outline shrunk towards its own centre, so a marker stays clear of the pocket wall. */
function shrink(outline, k) {
  const cx = outline.reduce((n, [x]) => n + x, 0) / outline.length;
  const cy = outline.reduce((n, [, y]) => n + y, 0) / outline.length;
  return outline.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

/** Coloured discs on the pocket floors, one colour per group. */
function PocketMarkers({ project, plan, highlightId, cut }) {
  const geometries = useMemo(() => plan.strips.map((s) => {
    if (!s.positions.length) return null;
    const outlines = cutOutlines({ ...s.group, notches: false }, project.layout, 48).map((o) => shrink(o, 0.92));
    const parts = s.positions.flatMap((p) => outlines.map((o) => new THREE.ShapeGeometry(new THREE.Shape(placeOutline(o, p).map(([x, y]) => new THREE.Vector2(x, y))))));
    const merged = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    return { group: s.group, seatZ: s.seatZ, geometry: merged, dispose: () => merged.dispose() };
  }).filter(Boolean), [plan, project.layout]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  return geometries.map(({ group, seatZ, geometry }) => (
    <mesh key={group.id} geometry={geometry} position={[0, 0, seatZ + 0.05]}>
      <meshBasicMaterial color={group.color} transparent opacity={highlightId && highlightId !== group.id ? 0.25 : 0.9} clippingPlanes={cut ? [CUT_PLANE] : []} />
    </mesh>
  ));
}

/**
 * A stand-in for one model, centred on its base: the base shape up to its full height,
 * and for a model that reaches past its base, that reach over its upper half. A model
 * without a base gets its hull above the floor, `lift` higher than where its touchpoints stand.
 */
function ghostGeometry(group, layout, lift) {
  const { sizeX, sizeY, heightMm, shape } = group;
  const z0 = shape === 'pads' ? Math.min(lift, heightMm / 2) : 0;
  const tall = heightMm - z0;
  const base = (shape === 'square' || shape === 'rect' || shape === 'pads'
    ? new THREE.BoxGeometry(sizeX * 0.9, sizeY * 0.9, tall)
    : new THREE.CylinderGeometry(0.45, 0.45, tall, 24).rotateX(Math.PI / 2).scale(sizeX, sizeY, 1)
  ).translate(0, 0, z0 + tall / 2);
  if (!hasOverhang(normalizeOverhang(group.overhang))) return base;
  const outline = reachOutline(group, layout, 32).map(([x, y]) => new THREE.Vector2(x, y));
  const reach = new THREE.ExtrudeGeometry(new THREE.Shape(outline), { depth: heightMm / 2, bevelEnabled: false })
    .translate(0, 0, heightMm / 2);
  const parts = [base.toNonIndexed(), reach.toNonIndexed()];
  parts.forEach((g) => g.deleteAttribute('uv'));
  const merged = mergeGeometries(parts);
  [base, reach, ...parts].forEach((g) => g.dispose());
  return merged;
}

/** Translucent stand-ins for the miniatures, to check heights against the bin and see which way they face. */
function MiniGhosts({ project, plan, highlightId, cut }) {
  const geometries = useMemo(() => plan.strips.map((s) => {
    const placed = s.positions.slice(0, s.group.count);
    if (!placed.length) return null;
    const ghost = ghostGeometry(s.group, project.layout, s.depth);
    const merged = mergeGeometries(placed.map(([x, y, turns]) => ghost.clone()
      .rotateZ(((Number(turns) || 0) * Math.PI) / 2)
      .translate(x, y, 0)));
    ghost.dispose();
    return { group: s.group, seatZ: s.seatZ, geometry: merged, dispose: () => merged.dispose() };
  }).filter(Boolean), [plan, project.layout]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  return geometries.map(({ group, seatZ, geometry }) => (
    <mesh key={group.id} geometry={geometry} position={[0, 0, seatZ]}>
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
    plan.strips.map((s) => [s.group.shape, s.group.sizeX, s.group.sizeY, s.group.notches, s.group.pads, s.depth, s.positions])]);

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
      {preview.showMinis && <MiniGhosts project={project} plan={plan} highlightId={highlightId} cut={cut} />}
    </group>
  );
}

export default Scene;
