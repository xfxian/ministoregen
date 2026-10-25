import { Add, DeleteOutline } from '@mui/icons-material';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { useState } from 'react';
import { makeModel } from '../../model/collection';
import { GROUP_COLORS } from '../../model/project';
import { overline, tokens } from '../../theme';
import BaseFields from '../BaseFields';
import Stepper from '../Stepper';
import BaseSketch from './BaseSketch';

function ColorPicker({ id, value, onChange }) {
  return (
    <div>
      <Typography sx={{ ...overline, mb: 1 }} id={id}>Colour</Typography>
      <Stack direction="row" spacing={1} role="radiogroup" aria-labelledby={id} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        {GROUP_COLORS.map((color) => (
          <Box
            key={color}
            component="button"
            type="button"
            role="radio"
            aria-checked={value === color}
            aria-label={color}
            onClick={() => onChange(color)}
            sx={{
              width: 32, height: 32, borderRadius: '50%', bgcolor: color, cursor: 'pointer', p: 0,
              border: `3px solid ${value === color ? tokens.text : 'transparent'}`,
              outlineOffset: 2,
            }}
          />
        ))}
      </Stack>
    </div>
  );
}

/** Base, count, height and colour of one model of a unit. */
function ModelFields({ model, index, several, stored, onChange, onRemove }) {
  const label = model.name || `Model ${index + 1}`;
  return (
    <Stack
      spacing={2}
      component={several ? 'fieldset' : 'div'}
      sx={several ? { m: 0, p: 1.5, border: `1px solid ${tokens.line}`, borderLeft: `4px solid ${model.color}`, borderRadius: 1 } : undefined}
    >
      {several && (
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="Model"
            size="small"
            value={model.name}
            placeholder={`Model ${index + 1}`}
            onChange={(e) => onChange({ name: e.target.value })}
            inputProps={{ maxLength: 60 }}
            sx={{ flex: 1 }}
          />
          <Tooltip title={`Remove ${label}`}>
            <IconButton onClick={onRemove} aria-label={`Remove ${label}`}><DeleteOutline /></IconButton>
          </Tooltip>
        </Stack>
      )}
      <Box sx={{ border: `1px solid ${tokens.line}`, borderRadius: 1, py: 1 }}><BaseSketch model={model} height={several ? 72 : 96} /></Box>
      <BaseFields value={model} onChange={onChange} />
      <Stack direction="row" spacing={1}>
        <Stepper label="How many" value={model.count} min={1} step={1} onChange={(v) => onChange({ count: Math.min(500, Math.max(1, Math.round(v))) })} />
        <Stepper label="Height" value={model.heightMm} unit="mm" min={1} step={1} onChange={(v) => onChange({ heightMm: Math.min(300, Math.max(1, v)) })} />
      </Stack>
      {model.count < stored && (
        <Typography variant="body2" sx={{ color: tokens.warn }}>
          {stored - model.count} will be taken out of their cases.
        </Typography>
      )}
      <ColorPicker id={`color-${model.id}`} value={model.color} onChange={(color) => onChange({ color })} />
    </Stack>
  );
}

/**
 * Adds or edits one unit and the models it is made of. Changes are kept in a draft
 * until saved, so cancelling leaves the collection untouched.
 */
function UnitDialog({ unit, isNew, storedCount, colorIndex = 0, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(unit);
  const several = draft.models.length > 1;
  const setModel = (id, patch) => setDraft((d) => ({ ...d, models: d.models.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const removeModel = (id) => setDraft((d) => ({ ...d, models: d.models.filter((m) => m.id !== id) }));
  const addModel = () => setDraft((d) => ({
    ...d,
    models: [...d.models, makeModel(colorIndex + d.models.length, { name: '', shape: 'round', sizeX: 25, sizeY: 25, count: 1, heightMm: 25 })],
  }));
  const removed = isNew ? 0 : unit.models
    .filter((m) => !draft.models.some((d) => d.id === m.id))
    .reduce((n, m) => n + storedCount(m.id), 0);

  const save = (e) => {
    e.preventDefault();
    onSave({ ...draft, name: draft.name.trim() || 'Unnamed', models: draft.models.map((m) => ({ ...m, name: m.name.trim() })) });
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth={several ? 'sm' : 'xs'} aria-labelledby="unit-dialog-title">
      <DialogTitle id="unit-dialog-title">{isNew ? 'Add a unit' : `Edit ${unit.name || 'unit'}`}</DialogTitle>
      <DialogContent dividers>
        <form id="unit-form" onSubmit={save}>
          <Stack spacing={2}>
            <TextField label="Name" size="small" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} autoFocus={isNew} inputProps={{ maxLength: 60 }} />
            {draft.models.map((m, i) => (
              <ModelFields
                key={m.id}
                model={m}
                index={i}
                several={several}
                stored={isNew ? 0 : storedCount(m.id)}
                onChange={(patch) => setModel(m.id, patch)}
                onRemove={() => removeModel(m.id)}
              />
            ))}
            {removed > 0 && (
              <Typography variant="body2" sx={{ color: tokens.warn }}>
                {removed} miniature{removed === 1 ? '' : 's'} of removed models will be taken out of their cases.
              </Typography>
            )}
            {draft.models.length < 12 && (
              <Box>
                <Button startIcon={<Add />} onClick={addModel}>Add a different model</Button>
                <Typography variant="body2" sx={{ color: tokens.muted, mt: 0.5 }}>
                  For units mixing bases or heights, like a battlesuit with its drones.
                </Typography>
              </Box>
            )}
          </Stack>
        </form>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        {isNew ? <span /> : <Button color="error" onClick={() => onDelete(unit.id)}>Delete unit</Button>}
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="unit-form" variant="contained">{isNew ? 'Add' : 'Save'}</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

export default UnitDialog;
