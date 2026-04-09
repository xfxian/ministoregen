import React, { useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  Grid2 as Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { BASE_HEIGHT, LIP_HEIGHT } from '../binGeometry';
import NumberInput from './NumberInput';
import { BASE_PRESETS, calcBinHeightFromGroups, makeDefaultGroup } from '../utils/wizardMath';

function HeightRow({ label, value, highlight }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
      <Typography variant="body2" color={highlight ? 'primary.main' : 'text.secondary'}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={highlight ? 700 : 400} color={highlight ? 'primary.main' : 'text.primary'}>
        {value.toFixed(2)} mm
      </Typography>
    </Stack>
  );
}

function GroupCard({ group, index, onChange, onRemove }) {
  const isRound = group.baseSizeX === group.baseSizeY;
  const isOval = !isRound && BASE_PRESETS.oval.some(
    (p) => p.sizeX === group.baseSizeX && p.sizeY === group.baseSizeY
  );
  const initialType = isRound ? 'round' : isOval ? 'oval' : 'custom';
  const [baseType, setBaseType] = useState(initialType);

  const handleBaseTypeChange = (_, v) => {
    if (!v) return;
    setBaseType(v);
    if (v === 'round') {
      const preset = BASE_PRESETS.round[0];
      onChange({ ...group, baseSizeX: preset.sizeX, baseSizeY: preset.sizeY });
    } else if (v === 'oval') {
      const preset = BASE_PRESETS.oval[0];
      onChange({ ...group, baseSizeX: preset.sizeX, baseSizeY: preset.sizeY });
    }
  };

  const presets = baseType === 'round' ? BASE_PRESETS.round : baseType === 'oval' ? BASE_PRESETS.oval : [];
  const matchedPreset = presets.find(
    (p) => p.sizeX === group.baseSizeX && p.sizeY === group.baseSizeY
  );
  const presetValue = matchedPreset ? `${matchedPreset.sizeX}x${matchedPreset.sizeY}` : '';

  const handlePresetChange = (e) => {
    const val = e.target.value;
    const [x, y] = val.split('x').map(Number);
    onChange({ ...group, baseSizeX: x, baseSizeY: y });
  };

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
        mb: 1.5,
        borderLeft: 4,
        borderLeftColor: group.color,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="body2" fontWeight={600}>
          Group {index + 1}
        </Typography>
        <Tooltip title="Remove group">
          <IconButton size="small" onClick={onRemove} color="error">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Base type toggle */}
      <ToggleButtonGroup
        exclusive
        value={baseType}
        fullWidth
        size="small"
        onChange={handleBaseTypeChange}
        sx={{ mb: 1 }}
      >
        <ToggleButton value="round">Round</ToggleButton>
        <ToggleButton value="oval">Oval</ToggleButton>
        <ToggleButton value="custom">Custom</ToggleButton>
      </ToggleButtonGroup>

      {/* Preset selector or custom W×L */}
      {baseType !== 'custom' ? (
        <TextField
          select
          label="Base Size"
          value={presetValue}
          onChange={handlePresetChange}
          fullWidth
          size="small"
          sx={{ mb: 1 }}
        >
          {presets.map((p) => (
            <MenuItem key={`${p.sizeX}x${p.sizeY}`} value={`${p.sizeX}x${p.sizeY}`}>
              {p.label}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <Grid container spacing={1} sx={{ mb: 1 }}>
          <Grid size={6}>
            <NumberInput
              label="Width"
              value={group.baseSizeX}
              onChange={(e) => onChange({ ...group, baseSizeX: parseFloat(e.target.value) || 1 })}
              fullWidth
              margin="none"
              step={1}
              unit="mm"
              min={1}
            />
          </Grid>
          <Grid size={6}>
            <NumberInput
              label="Length"
              value={group.baseSizeY}
              onChange={(e) => onChange({ ...group, baseSizeY: parseFloat(e.target.value) || 1 })}
              fullWidth
              margin="none"
              step={1}
              unit="mm"
              min={1}
            />
          </Grid>
        </Grid>
      )}

      {/* Count and height */}
      <Grid container spacing={1}>
        <Grid size={6}>
          <NumberInput
            label="Count"
            helperText="Number of miniatures"
            value={group.count}
            onChange={(e) => onChange({ ...group, count: Math.max(1, parseInt(e.target.value) || 1) })}
            fullWidth
            margin="none"
            step={1}
            unit=""
            min={1}
          />
        </Grid>
        <Grid size={6}>
          <NumberInput
            label="Height"
            helperText="Miniature height"
            value={group.heightMm}
            onChange={(e) => onChange({ ...group, heightMm: parseFloat(e.target.value) || 1 })}
            fullWidth
            margin="none"
            step={1}
            unit="mm"
            min={1}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

function MiniatureWizard({ groups, onChange, binConfig, showCylinders, onShowCylindersChange }) {
  const handleAddGroup = () => {
    onChange([...groups, makeDefaultGroup(groups.length)]);
  };

  const handleGroupChange = (index, updated) => {
    onChange(groups.map((g, i) => (i === index ? updated : g)));
  };

  const handleGroupRemove = (index) => {
    onChange(groups.filter((_, i) => i !== index));
  };

  const tallestGroup = groups.length > 0
    ? groups.reduce((a, b) => (a.heightMm >= b.heightMm ? a : b))
    : null;

  const totalHeight = calcBinHeightFromGroups(
    groups,
    binConfig.floorThickness,
    binConfig.stackingLip
  );

  return (
    <Box sx={{ px: 2 }}>
      {groups.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add miniature groups to automatically configure your bin and inlay.
          </Typography>
        </Box>
      ) : (
        groups.map((group, i) => (
          <GroupCard
            key={group.id}
            group={group}
            index={i}
            onChange={(updated) => handleGroupChange(i, updated)}
            onRemove={() => handleGroupRemove(i)}
          />
        ))
      )}

      <Button
        startIcon={<AddIcon />}
        variant="outlined"
        fullWidth
        size="small"
        onClick={handleAddGroup}
        sx={{ mb: 2 }}
      >
        Add Group
      </Button>

      {groups.length > 0 && (
        <>
          <Divider sx={{ mb: 1.5 }} />
          <Typography variant="overline" color="text.secondary">
            Calculated Bin Height
          </Typography>
          <Box sx={{ mt: 0.5, mb: 1.5 }}>
            {binConfig.baseFeet && (
              <HeightRow label="Base feet" value={BASE_HEIGHT} />
            )}
            <HeightRow label="Floor" value={binConfig.floorThickness} />
            <HeightRow
              label={`Interior (Group ${tallestGroup ? groups.indexOf(tallestGroup) + 1 : '—'})`}
              value={tallestGroup ? tallestGroup.heightMm : 0}
              highlight
            />
            {binConfig.stackingLip && (
              <HeightRow label="Stacking lip" value={LIP_HEIGHT} />
            )}
            <Divider sx={{ my: 0.5 }} />
            <HeightRow label="Total" value={totalHeight ?? 0} highlight />
          </Box>
        </>
      )}

      <Divider sx={{ mb: 1.5 }} />
      <FormControlLabel
        control={
          <Switch
            checked={showCylinders}
            onChange={(e) => onShowCylindersChange(e.target.checked)}
            color="primary"
            size="small"
          />
        }
        label="Show miniature cylinders"
        labelPlacement="start"
        sx={{ width: '100%', justifyContent: 'space-between', ml: 0 }}
      />
    </Box>
  );
}

export default MiniatureWizard;
