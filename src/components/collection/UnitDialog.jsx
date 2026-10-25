import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography,
} from '@mui/material';
import { useState } from 'react';
import { GROUP_COLORS } from '../../model/project';
import { overline, tokens } from '../../theme';
import BaseFields from '../BaseFields';
import Stepper from '../Stepper';
import BaseSketch from './BaseSketch';

/**
 * Adds or edits one unit. Changes are kept in a draft until saved, so cancelling
 * leaves the collection untouched.
 */
function UnitDialog({ unit, isNew, storedCount, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(unit);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const shrinking = !isNew && draft.count < storedCount;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="unit-dialog-title">
      <DialogTitle id="unit-dialog-title">{isNew ? 'Add a unit' : `Edit ${unit.name || 'unit'}`}</DialogTitle>
      <DialogContent dividers>
        <form id="unit-form" onSubmit={(e) => { e.preventDefault(); onSave({ ...draft, name: draft.name.trim() || 'Unnamed' }); }}>
          <Stack spacing={2}>
            <TextField label="Name" size="small" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus={isNew} inputProps={{ maxLength: 60 }} />
            <Box sx={{ border: `1px solid ${tokens.line}`, borderRadius: 1, py: 1 }}><BaseSketch unit={draft} height={96} /></Box>
            <BaseFields value={draft} onChange={set} />
            <Stack direction="row" spacing={1}>
              <Stepper label="How many" value={draft.count} min={1} step={1} onChange={(v) => set({ count: Math.min(500, Math.max(1, Math.round(v))) })} />
              <Stepper label="Height" value={draft.heightMm} unit="mm" min={1} step={1} onChange={(v) => set({ heightMm: Math.min(300, Math.max(1, v)) })} />
            </Stack>
            {shrinking && (
              <Typography variant="body2" sx={{ color: tokens.warn }}>
                {storedCount - draft.count} will be taken out of their cases.
              </Typography>
            )}
            <div>
              <Typography sx={{ ...overline, mb: 1 }} id="unit-color-label">Colour</Typography>
              <Stack direction="row" spacing={1} role="radiogroup" aria-labelledby="unit-color-label" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                {GROUP_COLORS.map((color) => (
                  <Box
                    key={color}
                    component="button"
                    type="button"
                    role="radio"
                    aria-checked={draft.color === color}
                    aria-label={color}
                    onClick={() => set({ color })}
                    sx={{
                      width: 32, height: 32, borderRadius: '50%', bgcolor: color, cursor: 'pointer', p: 0,
                      border: `3px solid ${draft.color === color ? tokens.text : 'transparent'}`,
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </Stack>
            </div>
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
