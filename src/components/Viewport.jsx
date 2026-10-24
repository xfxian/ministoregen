import { Bounds, Grid, OrbitControls, useBounds } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Box, CircularProgress, FormControlLabel, Paper, Switch, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useEffect } from 'react';
import { useManifold } from '../geometry/manifoldLoader';
import { patchPreview } from '../state/updates';
import Scene from './Scene';

const VIEWS = [
  { value: '3d', label: '3D' },
  { value: 'top', label: 'Top' },
  { value: 'cut', label: 'Cut' },
];

/** Re-frames the camera when the view or the bin size changes. */
function Framing({ view, sizeKey }) {
  const bounds = useBounds();
  const { camera } = useThree();
  useEffect(() => {
    if (view === 'top') camera.position.set(0, 400, 0.01);
    else if (view === 'cut') camera.position.set(400, 120, 0);
    else camera.position.set(260, 220, 300);
    camera.up.set(0, 1, 0);
    const timer = setTimeout(() => bounds.refresh().clip().fit(), 30);
    return () => clearTimeout(timer);
  }, [view, sizeKey, bounds, camera]);
  return null;
}

function Viewport({ project, plan, view, onViewChange, onUpdate, highlightId, binRef, inlayRef }) {
  const wasm = useManifold();
  const sizeKey = `${plan.unitsX}x${plan.unitsY}x${plan.heightMm}`;

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [260, 220, 300], fov: 35, near: 1, far: 5000 }} gl={{ localClippingEnabled: true, preserveDrawingBuffer: true }}>
        <color attach="background" args={['#15181d']} />
        <hemisphereLight args={['#ffffff', '#334', 1.4]} />
        <directionalLight position={[150, 300, 200]} intensity={1.8} />
        <directionalLight position={[-200, 150, -150]} intensity={0.6} />
        <Grid infiniteGrid cellSize={7} sectionSize={42} cellColor="#2a3038" sectionColor="#3d4652" fadeDistance={900} />
        <Bounds fit clip margin={1.15}>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <Scene wasm={wasm} project={project} plan={plan} view={view} highlightId={highlightId} binRef={binRef} inlayRef={inlayRef} />
          </group>
          <Framing view={view} sizeKey={sizeKey} />
        </Bounds>
        <OrbitControls makeDefault enableDamping={false} />
      </Canvas>

      <Paper elevation={2} sx={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 2, px: 1, py: 0.5 }}>
        <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, v) => v && onViewChange(v)} aria-label="View">
          {VIEWS.map((v) => <ToggleButton key={v.value} value={v.value} sx={{ px: 1.5 }}>{v.label}</ToggleButton>)}
        </ToggleButtonGroup>
        <FormControlLabel
          control={<Switch size="small" checked={project.preview.showMinis} onChange={(e) => onUpdate(patchPreview({ showMinis: e.target.checked }))} />}
          label={<Typography variant="body2">Minis</Typography>}
          sx={{ mr: 0.5 }}
        />
      </Paper>

      {!wasm && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <CircularProgress size={32} />
        </Box>
      )}
    </Box>
  );
}

export default Viewport;
