import { Bounds, Grid, OrbitControls, useBounds } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Box, CircularProgress, FormControlLabel, Switch, Typography } from '@mui/material';
import { useEffect } from 'react';
import { useManifold } from '../geometry/manifoldLoader';
import { patchPreview } from '../state/updates';
import { tokens } from '../theme';
import Scene from './Scene';

/** Re-frames the camera when the view or the bin size changes. */
function Framing({ view, sizeKey }) {
  const bounds = useBounds();
  const { camera } = useThree();
  useEffect(() => {
    if (view === 'cut') camera.position.set(400, 120, 0);
    else camera.position.set(260, 220, 300);
    camera.up.set(0, 1, 0);
    const timer = setTimeout(() => bounds.refresh().clip().fit(), 30);
    return () => clearTimeout(timer);
  }, [view, sizeKey, bounds, camera]);
  return null;
}

/** 3D preview of the printable parts; `view` is '3d' or 'cut' (cut-away along the length). */
function Viewport({ project, plan, view, onUpdate, highlightId }) {
  const wasm = useManifold();
  const sizeKey = `${plan.unitsX}x${plan.unitsY}x${plan.heightMm}`;

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [260, 220, 300], fov: 35, near: 1, far: 5000 }} gl={{ localClippingEnabled: true, preserveDrawingBuffer: true }}>
        <color attach="background" args={[tokens.bg]} />
        <hemisphereLight args={['#ffffff', '#334', 1.4]} />
        <directionalLight position={[150, 300, 200]} intensity={1.8} />
        <directionalLight position={[-200, 150, -150]} intensity={0.6} />
        <Grid infiniteGrid cellSize={7} sectionSize={42} cellColor="#1f2730" sectionColor="#33404d" fadeDistance={900} />
        <Bounds fit clip margin={1.15}>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <Scene wasm={wasm} project={project} plan={plan} view={view} highlightId={highlightId} />
          </group>
          <Framing view={view} sizeKey={sizeKey} />
        </Bounds>
        <OrbitControls makeDefault enableDamping={false} />
      </Canvas>

      <FormControlLabel
        control={<Switch size="small" checked={project.preview.showMinis} onChange={(e) => onUpdate(patchPreview({ showMinis: e.target.checked }))} />}
        label={<Typography variant="body2">Show minis</Typography>}
        sx={{ position: 'absolute', top: 10, right: 10, m: 0, pl: 1, pr: 1.5, borderRadius: 1, bgcolor: 'rgba(23,29,36,0.9)', border: `1px solid ${tokens.line}` }}
      />

      {!wasm && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <CircularProgress size={32} />
        </Box>
      )}
    </Box>
  );
}

export default Viewport;
