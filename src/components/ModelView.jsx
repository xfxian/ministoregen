import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { lazy, Suspense, useState } from 'react';
import { gridPaper, tokens } from '../theme';
import PlanDrawing from './PlanDrawing';

// The 3D view pulls in three.js; load it only when someone opens it.
const Viewport = lazy(() => import('./Viewport'));

const VIEWS = [
  { value: 'plan', label: 'Plan' },
  { value: '3d', label: '3D' },
  { value: 'cut', label: 'Cut' },
];

/** Plan drawing or 3D preview of one design, switchable. */
function ModelView({ project, plan, onUpdate, highlightId, minHeight = 320 }) {
  const [view, setView] = useState('plan');
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={view}
        onChange={(_, v) => v && setView(v)}
        aria-label="View"
        sx={{ alignSelf: 'flex-start', mb: 1, '& .MuiToggleButton-root': { px: 2, fontFamily: tokens.mono, fontSize: 12, letterSpacing: '0.08em' } }}
      >
        {VIEWS.map((v) => <ToggleButton key={v.value} value={v.value}>{v.label.toUpperCase()}</ToggleButton>)}
      </ToggleButtonGroup>
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 1, border: `1px solid ${tokens.line}`, overflow: 'hidden', ...gridPaper }}>
        {view === 'plan' ? (
          <Box sx={{ position: 'absolute', inset: 0, p: 2 }}>
            <PlanDrawing project={project} plan={plan} detailed highlightId={highlightId} />
          </Box>
        ) : (
          <Box sx={{ position: 'absolute', inset: 0 }}>
            <Suspense fallback={null}>
              <Viewport project={project} plan={plan} view={view} onUpdate={onUpdate} highlightId={highlightId} />
            </Suspense>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default ModelView;
