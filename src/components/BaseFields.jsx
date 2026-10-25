import {
  Box, FormControlLabel, MenuItem, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { useState } from 'react';
import { BASE_PRESETS } from '../model/project';
import {
  MAX_OVERHANG, SIDES, evenOverhang, largestOverhang, normalizeOverhang,
} from '../model/reach';
import { overline, tokens } from '../theme';
import Stepper from './Stepper';

const SHAPE_LABELS = { round: 'Round', oval: 'Oval', square: 'Square', rect: 'Rect' };

const presetKey = (x, y) => `${x}x${y}`;

const SIDE_LABELS = { front: 'Front', back: 'Back', left: 'Left', right: 'Right' };
const clampOverhang = (v) => Math.min(MAX_OVERHANG, Math.max(0, v));
const everySide = (v) => Object.fromEntries(SIDES.map((s) => [s, v]));

/**
 * How far the model reaches past its base: one value for every side, or one per side
 * for models that only stick out somewhere, like a gun held out to one side.
 */
function OverhangFields({ value, onChange }) {
  const overhang = normalizeOverhang(value);
  const [opened, setOpened] = useState(false);
  const perSide = opened || !evenOverhang(overhang);
  const togglePerSide = (on) => {
    setOpened(on);
    // Back to one value: keep the largest, so nothing that sticks out gets squeezed.
    if (!on) onChange({ overhang: everySide(largestOverhang(overhang)) });
  };

  return (
    <Box>
      {perSide ? (
        <Box component="fieldset" sx={{ m: 0, p: 0, border: 0 }}>
          <Typography component="legend" sx={{ ...overline, mb: 0.5 }}>Overhang</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1, rowGap: 1 }}>
            {['front', 'back', 'left', 'right'].map((side) => (
              <Stepper
                key={side}
                label={SIDE_LABELS[side]}
                value={overhang[side]}
                unit="mm"
                min={0}
                step={1}
                onChange={(v) => onChange({ overhang: { ...overhang, [side]: clampOverhang(v) } })}
              />
            ))}
          </Box>
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: tokens.muted }}>
            Seen from above with the model facing up. Pockets may turn it to fit; the top view shows which way.
          </Typography>
        </Box>
      ) : (
        <Stepper
          label="Overhang"
          value={overhang.front}
          unit="mm"
          min={0}
          step={1}
          helperText="How far the model reaches past its base on each side"
          onChange={(v) => onChange({ overhang: everySide(clampOverhang(v)) })}
        />
      )}
      <FormControlLabel
        control={<Switch size="small" checked={perSide} onChange={(e) => togglePerSide(e.target.checked)} />}
        label="Different on each side"
        slotProps={{ typography: { variant: 'body2' } }}
        sx={{ mt: 0.5, ml: 0 }}
      />
    </Box>
  );
}

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
      <OverhangFields value={value.overhang} onChange={onChange} />
    </Stack>
  );
}

export default BaseFields;
