import { Add, ArrowDownward, ArrowUpward, Delete } from '@mui/icons-material';
import {
  Box, Button, IconButton, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import { BASE_PRESETS, makeGroup } from '../model/project';
import { addGroup, moveGroup, patchGroup, removeGroup } from '../state/updates';
import Stepper from './Stepper';

const SHAPE_LABELS = { round: 'Round', oval: 'Oval', square: 'Square', rect: 'Rect' };

function presetKey(x, y) {
  return `${x}x${y}`;
}

function GroupCard({ group, index, total, fit, onUpdate, onHover }) {
  const presets = BASE_PRESETS[group.shape];
  const key = presetKey(group.sizeX, group.sizeY);
  const isPreset = presets.some((p) => presetKey(p.sizeX, p.sizeY) === key);
  const set = (patch) => onUpdate(patchGroup(group.id, patch));

  const changeShape = (shape) => {
    if (!shape) return;
    const first = BASE_PRESETS[shape][0];
    const keepsSize = (shape === 'round' || shape === 'square') ? group.sizeX === group.sizeY : group.sizeX !== group.sizeY;
    set(keepsSize ? { shape } : { shape, sizeX: first.sizeX, sizeY: first.sizeY });
  };

  return (
    <Box
      onMouseEnter={() => onHover(group.id)}
      onMouseLeave={() => onHover(null)}
      sx={{ border: 1, borderColor: 'divider', borderLeft: 4, borderLeftColor: group.color, borderRadius: 1, p: 1.5, mb: 1.5 }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <TextField
          variant="standard"
          value={group.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Name"
          inputProps={{ 'aria-label': 'Group name', style: { fontWeight: 600 } }}
          sx={{ flexGrow: 1 }}
        />
        <Tooltip title="Move up"><span>
          <IconButton size="small" disabled={index === 0} onClick={() => onUpdate(moveGroup(group.id, -1))}><ArrowUpward fontSize="small" /></IconButton>
        </span></Tooltip>
        <Tooltip title="Move down"><span>
          <IconButton size="small" disabled={index === total - 1} onClick={() => onUpdate(moveGroup(group.id, 1))}><ArrowDownward fontSize="small" /></IconButton>
        </span></Tooltip>
        <Tooltip title="Remove group">
          <IconButton size="small" onClick={() => onUpdate(removeGroup(group.id))} aria-label={`Remove ${group.name}`}><Delete fontSize="small" /></IconButton>
        </Tooltip>
      </Stack>

      <ToggleButtonGroup exclusive fullWidth size="small" value={group.shape} onChange={(_, v) => changeShape(v)} sx={{ mb: 1 }}>
        {Object.entries(SHAPE_LABELS).map(([value, label]) => (
          <ToggleButton key={value} value={value}>{label}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField
          select
          size="small"
          label="Base"
          value={isPreset ? key : 'custom'}
          onChange={(e) => {
            if (e.target.value === 'custom') return;
            const [x, y] = e.target.value.split('x').map(Number);
            set({ sizeX: x, sizeY: y });
          }}
          sx={{ flex: 1 }}
        >
          {presets.map((p) => (
            <MenuItem key={presetKey(p.sizeX, p.sizeY)} value={presetKey(p.sizeX, p.sizeY)}>{p.label}</MenuItem>
          ))}
          <MenuItem value="custom">Custom size</MenuItem>
        </TextField>
      </Stack>
      {!isPreset && (
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Stepper label="Base width" value={group.sizeX} unit="mm" min={5} step={0.5}
            onChange={(v) => set(group.shape === 'round' || group.shape === 'square' ? { sizeX: v, sizeY: v } : { sizeX: v })} />
          {(group.shape === 'oval' || group.shape === 'rect') && (
            <Stepper label="Base length" value={group.sizeY} unit="mm" min={5} step={0.5} onChange={(v) => set({ sizeY: v })} />
          )}
        </Stack>
      )}

      <Stack direction="row" spacing={1}>
        <Stepper label="Count" value={group.count} min={1} step={1} onChange={(v) => set({ count: Math.max(1, Math.round(v)) })} />
        <Stepper label="Height" value={group.heightMm} unit="mm" min={1} step={1} onChange={(v) => set({ heightMm: Math.max(1, v) })} />
      </Stack>
      {fit && (
        <Typography variant="caption" color={fit.capacity >= group.count ? 'text.secondary' : 'error.main'} sx={{ display: 'block', mt: 1 }}>
          {fit.capacity >= group.count
            ? `${fit.capacity} pocket${fit.capacity === 1 ? '' : 's'}${fit.capacity > group.count ? ` (${fit.capacity - group.count} spare)` : ''}`
            : `Only ${fit.capacity} of ${group.count} fit`}
        </Typography>
      )}
    </Box>
  );
}

function GroupsStep({ project, plan, onUpdate, onHover }) {
  const { groups } = project;
  return (
    <Box>
      {groups.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add the miniatures you want to store. The bin and the pocket layout follow automatically.
        </Typography>
      )}
      {groups.map((g, i) => (
        <GroupCard
          key={g.id}
          group={g}
          index={i}
          total={groups.length}
          fit={plan.strips.find((s) => s.group.id === g.id)}
          onUpdate={onUpdate}
          onHover={onHover}
        />
      ))}
      <Button
        startIcon={<Add />}
        variant="outlined"
        fullWidth
        onClick={() => onUpdate(addGroup(makeGroup(groups.length)))}
      >
        Add group
      </Button>
    </Box>
  );
}

export default GroupsStep;
