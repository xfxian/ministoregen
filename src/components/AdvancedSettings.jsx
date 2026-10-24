import { ExpandMore } from '@mui/icons-material';
import {
  Accordion, AccordionDetails, AccordionSummary, Grid2 as Grid, MenuItem, TextField, Typography,
} from '@mui/material';
import { patchBin, patchLayout, patchPreview } from '../state/updates';
import Stepper from './Stepper';

function AdvancedSettings({ project, onUpdate }) {
  const { bin, layout, preview } = project;
  const field = (label, value, onChange, props = {}) => (
    <Grid size={6}><Stepper label={label} value={value} onChange={onChange} unit="mm" min={0} step={0.1} {...props} /></Grid>
  );
  return (
    <Accordion disableGutters elevation={0} sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 0 }}>
        <Typography variant="body2" color="text.secondary">Advanced: walls, floor, clearances, spacing</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0 }}>
        <Typography variant="overline" color="text.secondary">Bin</Typography>
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          {field('Wall', bin.wall, (v) => onUpdate(patchBin({ wall: Math.max(0.4, v) })), { helperText: 'Gridfinity default 0.95' })}
          {field('Floor', bin.floor, (v) => onUpdate(patchBin({ floor: Math.max(0.4, v) })), { helperText: 'Above the feet' })}
          {field('Largest bin', bin.maxUnits, (v) => onUpdate(patchBin({ maxUnits: Math.min(12, Math.max(1, Math.round(v))) })), { unit: 'u', step: 1, helperText: 'Printer bed limit' })}
        </Grid>
        <Typography variant="overline" color="text.secondary">Pockets</Typography>
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          {field('Base clearance', layout.baseClearance, (v) => onUpdate(patchLayout({ baseClearance: v })), { helperText: 'Added to the base size' })}
          {field('Spacing', layout.spacing, (v) => onUpdate(patchLayout({ spacing: v })), { helperText: 'Between pockets' })}
          {field('Margin', layout.margin, (v) => onUpdate(patchLayout({ margin: v })), { helperText: 'To the edge' })}
          {field('Curvature', layout.curvature, (v) => onUpdate(patchLayout({ curvature: Math.min(1, Math.max(0.2, v)) })), { unit: '', step: 0.01, helperText: '0.55 = true ellipse' })}
          {layout.pocketMode === 'floor'
            ? field('Pocket depth', layout.pocketDepth, (v) => onUpdate(patchLayout({ pocketDepth: Math.max(0.4, v) })))
            : field('Inlay thickness', layout.inlayDepth, (v) => onUpdate(patchLayout({ inlayDepth: Math.max(0.4, v) })))}
          {layout.pocketMode === 'inlay' && field('Inlay clearance', layout.inlayClearance, (v) => onUpdate(patchLayout({ inlayClearance: v })), { helperText: 'Total, to the lip' })}
        </Grid>
        <Typography variant="overline" color="text.secondary">Preview</Typography>
        <Grid container spacing={1.5}>
          <Grid size={6}>
            <TextField type="color" label="Color" size="small" fullWidth value={preview.color} onChange={(e) => onUpdate(patchPreview({ color: e.target.value }))} />
          </Grid>
          <Grid size={6}>
            <TextField select label="Smoothness" size="small" fullWidth value={preview.segments} onChange={(e) => onUpdate(patchPreview({ segments: Number(e.target.value) }))}>
              {[16, 32, 64, 96].map((n) => <MenuItem key={n} value={n}>{n} segments</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
}

export default AdvancedSettings;
