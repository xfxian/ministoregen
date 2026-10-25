import { FormControlLabel, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { HEIGHT_UNIT, LIP_HEIGHT, LIP_TIP } from '../geometry/gridfinity';
import { LID_SNAP_DEPTH } from '../geometry/lid';
import { patchBin, patchLayout } from '../state/updates';
import Stepper from './Stepper';

const LID_HELP = {
  none: 'Bins stack straight on each other.',
  flat: 'A flat lid that seats in the stacking lip, so it cannot slide off.',
  stackable: 'Seats in the lip and has a baseplate grid on top, so other bins stack on the lid.',
  needsLip: 'Lids sit in the stacking lip. Turn the lip on to add one.',
};

function Toggle({ label, checked, onChange, help, disabled = false }) {
  return (
    <FormControlLabel
      control={<Switch size="small" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />}
      label={<span>{label}{help && <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>{help}</Typography>}</span>}
      labelPlacement="start"
      sx={{ mx: 0, width: '100%', justifyContent: 'space-between' }}
    />
  );
}

function BinStep({ project, plan, onUpdate }) {
  const { bin, layout } = project;
  const set = (patch) => onUpdate(patchBin(patch));
  const totalHeight = plan.heightMm + (bin.lip ? LIP_HEIGHT - LIP_TIP : 0);

  return (
    <Stack spacing={1.5}>
      <Typography variant="body1" fontWeight={600} data-testid="bin-summary">
        {plan.unitsX} × {plan.unitsY} units, {plan.heightUnits}u high
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mt: '0 !important' }}>
        {plan.unitsX * 42} × {plan.unitsY * 42} mm grid footprint, {totalHeight.toFixed(1)} mm tall{bin.lip ? ' including the stacking lip' : ''}{plan.lid ? `, plus a ${plan.lid.height.toFixed(1)} mm lid` : ''}
      </Typography>

      <div>
        <Typography variant="overline" color="text.secondary">Pockets</Typography>
        <ToggleButtonGroup
          exclusive fullWidth size="small"
          value={layout.pocketMode}
          onChange={(_, v) => v && onUpdate(patchLayout({ pocketMode: v }))}
        >
          <ToggleButton value="inlay">Drop-in inlay</ToggleButton>
          <ToggleButton value="floor">In the bin floor</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {layout.pocketMode === 'inlay'
            ? 'A separate plate that drops into the bin. Swap layouts without reprinting the bin.'
            : 'Pockets are cut into a thicker floor. One print, and more room for pockets.'}
        </Typography>
      </div>

      <Toggle label="Size footprint automatically" checked={bin.autoFootprint} onChange={(v) => set(v ? { autoFootprint: true } : { autoFootprint: false, unitsX: plan.unitsX, unitsY: plan.unitsY })} />
      {!bin.autoFootprint && (
        <Stack direction="row" spacing={1}>
          <Stepper label="Width" value={bin.unitsX} unit="u" min={1} step={1} onChange={(v) => set({ unitsX: Math.max(1, Math.round(v)) })} />
          <Stepper label="Length" value={bin.unitsY} unit="u" min={1} step={1} onChange={(v) => set({ unitsY: Math.max(1, Math.round(v)) })} />
        </Stack>
      )}
      <Toggle label="Fit height to the tallest miniature" checked={bin.autoHeight} onChange={(v) => set(v ? { autoHeight: true } : { autoHeight: false, heightUnits: plan.heightUnits })} />
      {!bin.autoHeight && (
        <Stepper label="Height" helperText={`1u = ${HEIGHT_UNIT} mm, including feet, excluding the lip`} value={bin.heightUnits} unit="u" min={1} step={1}
          onChange={(v) => set({ heightUnits: Math.max(1, Math.round(v)) })} />
      )}
      <Toggle label="Stacking lip" help="Lets other Gridfinity bins stack on top" checked={bin.lip} onChange={(v) => set({ lip: v })} />
      <Toggle label="Gridfinity feet" help="Off for a flat bottom" checked={bin.feet} onChange={(v) => set({ feet: v })} />

      <div>
        <Typography variant="overline" color="text.secondary">Lid</Typography>
        <ToggleButtonGroup
          exclusive fullWidth size="small"
          value={bin.lip ? bin.lid : 'none'}
          disabled={!bin.lip}
          onChange={(_, v) => v && set({ lid: v })}
          aria-label="Lid"
        >
          <ToggleButton value="none">None</ToggleButton>
          <ToggleButton value="flat">Flat</ToggleButton>
          <ToggleButton value="stackable">Stackable</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {LID_HELP[bin.lip ? bin.lid : 'needsLip']}
        </Typography>
      </div>
      <Toggle
        label="Snap clips"
        help={`Spring clips catch in a groove in the bin wall, so the lid stays on until you pull it off. Needs ${LID_SNAP_DEPTH.toFixed(1)} mm more headroom.`}
        checked={bin.lidSnap}
        disabled={!bin.lip || bin.lid === 'none'}
        onChange={(v) => set({ lidSnap: v })}
      />
    </Stack>
  );
}

export default BinStep;
