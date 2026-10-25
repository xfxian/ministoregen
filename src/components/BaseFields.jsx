import { Add, DeleteOutline } from '@mui/icons-material';
import {
  Box, Button, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import { useState } from 'react';
import { PAD_LAYOUTS, clampPad, padLayout } from '../model/pockets';
import { BASE_PRESETS, MAX_POCKET_DEPTH, MIN_POCKET_DEPTH } from '../model/project';
import {
  MAX_OVERHANG, SIDES, evenOverhang, largestOverhang, normalizeOverhang,
} from '../model/reach';
import { overline, tokens } from '../theme';
import Stepper from './Stepper';

const SHAPE_LABELS = { round: 'Round', oval: 'Oval', square: 'Square', rect: 'Rect', pads: 'No base' };
const PAD_LAYOUT_LABELS = { tracks: 'Tracks', three: '3 legs', four: '4 legs' };
const MAX_PADS = 12;
// Where a new pocket depth starts when someone switches it on: a bit deeper than the usual 3 mm.
const NEW_POCKET_DEPTH = 6;

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
 * Where a model without a base touches the ground: a starting layout (tracks or legs),
 * then each touchpoint's place and size, measured from the middle of the footprint.
 */
function PadFields({ value, onChange }) {
  const pads = value.pads ?? [];
  const setPad = (i, patch) => onChange({
    pads: pads.map((p, j) => (j === i ? clampPad({ ...p, ...patch }, value.sizeX, value.sizeY) : p)),
  });
  return (
    <Box component="fieldset" sx={{ m: 0, p: 0, border: 0 }}>
      <Typography component="legend" sx={{ ...overline, mb: 0.5 }}>Touchpoints</Typography>
      <Typography variant="caption" sx={{ display: 'block', mb: 1, color: tokens.muted }}>
        Only these are cut as pockets; the rest of the footprint stays clear of other models.
        Measured from the middle, seen from above with the model facing up.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} useFlexGap flexWrap="wrap">
        {PAD_LAYOUTS.map((kind) => (
          <Button key={kind} size="small" variant="outlined" onClick={() => onChange({ pads: padLayout(kind, value.sizeX, value.sizeY) })}>
            {PAD_LAYOUT_LABELS[kind]}
          </Button>
        ))}
      </Stack>
      <Stack spacing={1.5}>
        {pads.map((pad, i) => (
          <Box key={i} sx={{ border: `1px solid ${tokens.line}`, borderRadius: 1, p: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>Touchpoint {i + 1}</Typography>
              <ToggleButtonGroup exclusive size="small" value={pad.shape} onChange={(_, v) => v && setPad(i, { shape: v })} aria-label={`Touchpoint ${i + 1} shape`}>
                <ToggleButton value="round">Round</ToggleButton>
                <ToggleButton value="rect">Rect</ToggleButton>
              </ToggleButtonGroup>
              <Tooltip title={`Remove touchpoint ${i + 1}`}><span>
                <IconButton size="small" disabled={pads.length < 2} onClick={() => onChange({ pads: pads.filter((_, j) => j !== i) })} aria-label={`Remove touchpoint ${i + 1}`}>
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </span></Tooltip>
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1, rowGap: 1 }}>
              <Stepper label="Right" value={round1(pad.x)} unit="mm" step={1} onChange={(v) => setPad(i, { x: v })} />
              <Stepper label="Front" value={round1(pad.y)} unit="mm" step={1} onChange={(v) => setPad(i, { y: v })} />
              <Stepper label="Width" value={round1(pad.sizeX)} unit="mm" min={1} step={1} onChange={(v) => setPad(i, { sizeX: v })} />
              <Stepper label="Length" value={round1(pad.sizeY)} unit="mm" min={1} step={1} onChange={(v) => setPad(i, { sizeY: v })} />
            </Box>
          </Box>
        ))}
      </Stack>
      <Button
        size="small"
        startIcon={<Add />}
        disabled={pads.length >= MAX_PADS}
        onClick={() => onChange({ pads: [...pads, clampPad({ x: 0, y: 0, sizeX: 10, sizeY: 10, shape: 'round' }, value.sizeX, value.sizeY)] })}
        sx={{ mt: 1 }}
      >
        Add touchpoint
      </Button>
    </Box>
  );
}

const round1 = (v) => Math.round(v * 10) / 10;

/** Pocket depth of its own, and finger notches to lift the model out by. */
function PocketFields({ value, onChange }) {
  const own = value.pocketDepth !== null && value.pocketDepth !== undefined;
  return (
    <Box>
      <FormControlLabel
        control={<Switch size="small" checked={own} onChange={(e) => onChange({ pocketDepth: e.target.checked ? NEW_POCKET_DEPTH : null })} />}
        label="Own pocket depth"
        slotProps={{ typography: { variant: 'body2' } }}
        sx={{ ml: 0 }}
      />
      {own && (
        <Box sx={{ mt: 1 }}>
          <Stepper
            label="Pocket depth"
            value={value.pocketDepth}
            unit="mm"
            min={MIN_POCKET_DEPTH}
            step={1}
            helperText="Deeper holds heavy or tall models better. The whole floor or inlay gets as thick as the deepest pocket."
            onChange={(v) => onChange({ pocketDepth: Math.min(MAX_POCKET_DEPTH, Math.max(MIN_POCKET_DEPTH, v)) })}
          />
        </Box>
      )}
      <FormControlLabel
        control={<Switch size="small" checked={Boolean(value.notches)} onChange={(e) => onChange({ notches: e.target.checked })} />}
        label="Finger notches"
        slotProps={{ typography: { variant: 'body2' } }}
        sx={{ ml: 0, display: 'flex' }}
      />
      {value.notches && (
        <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: tokens.muted }}>
          Two cut-outs on the long sides, to get fingers under the model. They take a little more room.
        </Typography>
      )}
    </Box>
  );
}

/**
 * Base shape and size of a group or unit: shape buttons, a preset list, custom sizes,
 * and how far the model sticks out past its base.
 */
function BaseFields({ value, onChange: report }) {
  const presets = BASE_PRESETS[value.shape];
  const noBase = value.shape === 'pads';
  // Touchpoints stay inside the footprint when it shrinks.
  const onChange = (patch) => {
    if (!noBase || !('sizeX' in patch || 'sizeY' in patch) || 'pads' in patch) return report(patch);
    const sizeX = patch.sizeX ?? value.sizeX;
    const sizeY = patch.sizeY ?? value.sizeY;
    return report({ ...patch, pads: (value.pads ?? []).map((p) => clampPad(p, sizeX, sizeY)) });
  };
  const key = presetKey(value.sizeX, value.sizeY);
  const isPreset = presets.some((p) => presetKey(p.sizeX, p.sizeY) === key);
  const symmetric = value.shape === 'round' || value.shape === 'square';

  const changeShape = (shape) => {
    if (!shape) return;
    if (shape === 'pads') {
      onChange({ shape, pads: value.pads?.length ? value.pads.map((p) => clampPad(p, value.sizeX, value.sizeY)) : padLayout(PAD_LAYOUTS[0], value.sizeX, value.sizeY) });
      return;
    }
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
      {!noBase && <TextField
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
      </TextField>}
      {!isPreset && (
        <Stack direction="row" spacing={1}>
          <Stepper label={noBase ? 'Footprint width' : symmetric ? 'Base size' : 'Base width'} value={value.sizeX} unit="mm" min={5} step={0.5}
            onChange={(v) => onChange(symmetric ? { sizeX: v, sizeY: v } : { sizeX: v })} />
          {!symmetric && (
            <Stepper label={noBase ? 'Footprint length' : 'Base length'} value={value.sizeY} unit="mm" min={5} step={0.5} onChange={(v) => onChange({ sizeY: v })} />
          )}
        </Stack>
      )}
      {noBase && (
        <Typography variant="caption" sx={{ color: tokens.muted, mt: -0.5 }}>
          The area the model stands over at ground level. Use overhang for anything wider higher up.
        </Typography>
      )}
      {noBase && <PadFields value={value} onChange={onChange} />}
      <OverhangFields value={value.overhang} onChange={onChange} />
      <PocketFields value={value} onChange={onChange} />
    </Stack>
  );
}

export default BaseFields;
