import { MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { BASE_PRESETS } from '../model/project';
import Stepper from './Stepper';

const SHAPE_LABELS = { round: 'Round', oval: 'Oval', square: 'Square', rect: 'Rect' };

const presetKey = (x, y) => `${x}x${y}`;

/**
 * Base shape and size of a group or unit: shape buttons, a preset list, custom sizes,
 * and how far the model sticks out past its base.
 */
function BaseFields({ value, onChange }) {
  const presets = BASE_PRESETS[value.shape];
  const key = presetKey(value.sizeX, value.sizeY);
  const isPreset = presets.some((p) => presetKey(p.sizeX, p.sizeY) === key);
  const symmetric = value.shape === 'round' || value.shape === 'square';

  const changeShape = (shape) => {
    if (!shape) return;
    const first = BASE_PRESETS[shape][0];
    const keepsSize = (shape === 'round' || shape === 'square') ? value.sizeX === value.sizeY : value.sizeX !== value.sizeY;
    onChange(keepsSize ? { shape } : { shape, sizeX: first.sizeX, sizeY: first.sizeY });
  };

  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup exclusive fullWidth size="small" value={value.shape} onChange={(_, v) => changeShape(v)} aria-label="Base shape">
        {Object.entries(SHAPE_LABELS).map(([shape, label]) => (
          <ToggleButton key={shape} value={shape}>{label}</ToggleButton>
        ))}
      </ToggleButtonGroup>
      <TextField
        select
        size="small"
        label="Base"
        value={isPreset ? key : 'custom'}
        onChange={(e) => {
          if (e.target.value === 'custom') {
            // Nudge off the preset so the custom fields appear.
            onChange({ sizeX: value.sizeX + 0.5, sizeY: symmetric ? value.sizeX + 0.5 : value.sizeY });
            return;
          }
          const [x, y] = e.target.value.split('x').map(Number);
          onChange({ sizeX: x, sizeY: y });
        }}
      >
        {presets.map((p) => (
          <MenuItem key={presetKey(p.sizeX, p.sizeY)} value={presetKey(p.sizeX, p.sizeY)}>{p.label}</MenuItem>
        ))}
        <MenuItem value="custom">Custom size</MenuItem>
      </TextField>
      {!isPreset && (
        <Stack direction="row" spacing={1}>
          <Stepper label={symmetric ? 'Base size' : 'Base width'} value={value.sizeX} unit="mm" min={5} step={0.5}
            onChange={(v) => onChange(symmetric ? { sizeX: v, sizeY: v } : { sizeX: v })} />
          {!symmetric && (
            <Stepper label="Base length" value={value.sizeY} unit="mm" min={5} step={0.5} onChange={(v) => onChange({ sizeY: v })} />
          )}
        </Stack>
      )}
      <Stepper
        label="Overhang"
        value={value.overhang ?? 0}
        unit="mm"
        min={0}
        step={1}
        helperText="How far the model reaches past its base on each side"
        onChange={(v) => onChange({ overhang: Math.min(100, Math.max(0, v)) })}
      />
    </Stack>
  );
}

export default BaseFields;
