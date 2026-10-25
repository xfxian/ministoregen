import { Grid, OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Box, CircularProgress, FormControlLabel, Switch, Typography } from '@mui/material';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useManifold } from '../geometry/manifoldLoader';
import { patchPreview } from '../state/updates';
import { tokens } from '../theme';
import Scene from './Scene';
import { minDistanceForScale, wheelZoomSpeed } from './viewScale';

const MARGIN = 1.25;
const VIEW_DIRECTION = {
  '3d': new THREE.Vector3(260, 220, 300).normalize(),
  cut: new THREE.Vector3(400, 120, 0).normalize(),
};

/**
 * Re-frames the camera on the shown parts when the view, the bin size or the loaded
 * geometry changes, and puts the orbit centre in the middle of them. Small bins are
 * not zoomed past MAX_PX_PER_MM, so a 1x1 bin does not fill a big screen.
 */
function Framing({ view, frameKey, targetRef }) {
  const { camera, controls, get } = useThree();
  useEffect(() => {
    if (!controls) return undefined;
    const timer = setTimeout(() => {
      const target = targetRef.current;
      if (!target) return;
      target.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(target);
      if (box.isEmpty()) return;
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z);
      const fitHeight = maxSize / (2 * Math.tan((camera.fov * Math.PI) / 360));
      const fitDistance = MARGIN * Math.max(fitHeight, fitHeight / camera.aspect);
      const distance = Math.max(fitDistance, minDistanceForScale(camera.fov, get().size.height));
      camera.up.set(0, 1, 0);
      camera.position.copy(center).addScaledVector(VIEW_DIRECTION[view], distance);
      camera.near = distance / 100;
      camera.far = distance * 100;
      camera.updateProjectionMatrix();
      controls.target.copy(center);
      controls.maxDistance = distance * 10;
      controls.update();
    }, 30);
    return () => clearTimeout(timer);
  }, [view, frameKey, targetRef, camera, controls, get]);
  return null;
}

/** Makes each wheel event zoom in proportion to how far it scrolled; see wheelZoomSpeed. */
function WheelZoom() {
  const { gl, controls } = useThree();
  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent || !controls) return undefined;
    // Capture on the parent runs before OrbitControls' own listener on the canvas.
    const onWheel = (event) => { controls.zoomSpeed = wheelZoomSpeed(event); };
    parent.addEventListener('wheel', onWheel, { capture: true, passive: true });
    return () => parent.removeEventListener('wheel', onWheel, { capture: true });
  }, [gl, controls]);
  return null;
}

/** 3D preview of the printable parts; `view` is '3d' or 'cut' (cut-away along the length). */
function Viewport({ project, plan, view, onUpdate, highlightId }) {
  const wasm = useManifold();
  const partsRef = useRef(null);
  // The parts only exist once manifold has loaded, so that re-frames too.
  const frameKey = `${plan.unitsX}x${plan.unitsY}x${plan.heightMm}x${plan.lid && project.preview.showLid ? plan.lid.style : ''}x${wasm ? 'ready' : ''}`;

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [260, 220, 300], fov: 35, near: 1, far: 5000 }} gl={{ localClippingEnabled: true, preserveDrawingBuffer: true }}>
        <color attach="background" args={[tokens.bg]} />
        <hemisphereLight args={['#ffffff', '#334', 1.4]} />
        <directionalLight position={[150, 300, 200]} intensity={1.8} />
        <directionalLight position={[-200, 150, -150]} intensity={0.6} />
        <Grid infiniteGrid cellSize={7} sectionSize={42} cellColor="#1f2730" sectionColor="#33404d" fadeDistance={900} />
        <group ref={partsRef} rotation={[-Math.PI / 2, 0, 0]}>
          <Scene wasm={wasm} project={project} plan={plan} view={view} highlightId={highlightId} />
        </group>
        <Framing view={view} frameKey={frameKey} targetRef={partsRef} />
        <OrbitControls makeDefault enableDamping={false} />
        <WheelZoom />
      </Canvas>

      <Box sx={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', alignItems: 'stretch', px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(23,29,36,0.9)', border: `1px solid ${tokens.line}` }}>
        <FormControlLabel
          control={<Switch size="small" checked={project.preview.showMinis} onChange={(e) => onUpdate(patchPreview({ showMinis: e.target.checked }))} />}
          label={<Typography variant="body2">Show minis</Typography>}
          sx={{ m: 0 }}
        />
        {plan.lid && (
          <FormControlLabel
            control={<Switch size="small" checked={project.preview.showLid} onChange={(e) => onUpdate(patchPreview({ showLid: e.target.checked }))} />}
            label={<Typography variant="body2">Show lid</Typography>}
            sx={{ m: 0 }}
          />
        )}
      </Box>

      {!wasm && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <CircularProgress size={32} />
        </Box>
      )}
    </Box>
  );
}

export default Viewport;
