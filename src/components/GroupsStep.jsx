import { Add, ArrowDownward, ArrowUpward, Delete } from '@mui/icons-material';
import { Box, Button, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { makeGroup } from '../model/project';
import { addGroup, moveGroup, patchGroup, removeGroup } from '../state/updates';
import { tokens } from '../theme';
import BaseFields from './BaseFields';
import Stepper from './Stepper';

function GroupCard({ group, index, total, fit, onUpdate, onHover }) {
  const set = (patch) => onUpdate(patchGroup(group.id, patch));

  return (
    <Box
      onMouseEnter={() => onHover(group.id)}
      onMouseLeave={() => onHover(null)}
      sx={{ border: 1, borderColor: 'divider', borderLeft: 4, borderLeftColor: group.color, borderRadius: 1, p: 1.5, mb: 1.5, bgcolor: tokens.raised }}
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
          <IconButton size="small" disabled={index === 0} onClick={() => onUpdate(moveGroup(group.id, -1))} aria-label={`Move ${group.name} up`}><ArrowUpward fontSize="small" /></IconButton>
        </span></Tooltip>
        <Tooltip title="Move down"><span>
          <IconButton size="small" disabled={index === total - 1} onClick={() => onUpdate(moveGroup(group.id, 1))} aria-label={`Move ${group.name} down`}><ArrowDownward fontSize="small" /></IconButton>
        </span></Tooltip>
        <Tooltip title="Remove group">
          <IconButton size="small" onClick={() => onUpdate(removeGroup(group.id))} aria-label={`Remove ${group.name}`}><Delete fontSize="small" /></IconButton>
        </Tooltip>
      </Stack>
      <Box sx={{ mb: 1 }}><BaseFields value={group} onChange={set} /></Box>
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
