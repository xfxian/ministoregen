import { AutoAwesome } from '@mui/icons-material';
import {
  Box, Button, ButtonBase, Checkbox, Divider, FormControlLabel, ListItemText, Menu, MenuItem, Typography,
} from '@mui/material';
import { useState } from 'react';
import { unassigned } from '../../model/collection';
import { overline, tokens } from '../../theme';
import { baseLabel } from './BaseSketch';

export const UNIT_DRAG_TYPE = 'application/x-ministoregen-unit';

/**
 * Units with miniatures that are not in a case yet. Drag one onto a case, pick a
 * case from its menu, or let the app sort everything.
 */
function Shelf({ collection, statuses, onAssign, onSort, onKeepTogether }) {
  const waiting = unassigned(collection);
  const [menu, setMenu] = useState(null);
  const total = waiting.reduce((n, w) => n + w.count, 0);

  if (!collection.units.length) return null;

  return (
    <Box
      component="section"
      aria-labelledby="shelf-title"
      sx={{
        display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, borderRadius: 1.5,
        bgcolor: tokens.panel, border: `1px dashed ${total ? tokens.accent : tokens.line}`,
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, width: '100%' }}>
        <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
          <Typography id="shelf-title" component="h2" sx={{ ...overline, color: total ? tokens.accentText : tokens.muted }}>
            Not in a case yet{total ? ` · ${total}` : ''}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.muted, mt: 0.5 }}>
            {total ? 'Drag a unit onto a case, tap it to choose one, or sort everything at once.' : 'Every miniature has a home.'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={<Checkbox size="small" checked={collection.keepTogether} onChange={(e) => onKeepTogether(e.target.checked)} />}
            label={<Typography variant="body2">Keep units together</Typography>}
            sx={{ mr: 0.5 }}
          />
          <Button variant="contained" startIcon={<AutoAwesome />} disabled={!total} onClick={onSort}>Sort into cases</Button>
        </Box>
      </Box>

      {waiting.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, width: '100%' }}>
          {waiting.map(({ unit, count }) => (
            <ButtonBase
              key={unit.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(UNIT_DRAG_TYPE, unit.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={(e) => setMenu({ anchor: e.currentTarget, unit })}
              aria-haspopup="menu"
              aria-label={`${unit.name}, ${count} waiting. Choose a case`}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 48, pl: 1, pr: 1.5, borderRadius: 1,
                bgcolor: tokens.raised, border: `1px solid ${tokens.lineStrong}`, cursor: 'grab', maxWidth: '100%',
                '&:hover': { borderColor: unit.color },
                '&.Mui-focusVisible': { outline: `2px solid ${tokens.accent}`, outlineOffset: 2 },
              }}
            >
              <Box sx={{ width: 28, height: 28, borderRadius: unit.shape === 'round' || unit.shape === 'oval' ? '50%' : '4px', border: `2px solid ${unit.color}`, flexShrink: 0 }} />
              <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit.name} ×{count}</Typography>
                <Typography sx={{ fontFamily: tokens.mono, fontSize: 11, color: tokens.muted }}>{baseLabel(unit)} · {unit.heightMm} mm</Typography>
              </Box>
            </ButtonBase>
          ))}
        </Box>
      )}

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <Typography sx={{ ...overline, fontSize: 11 }}>Move {menu?.unit.name} to</Typography>
        </MenuItem>
        {collection.cases.map((c) => (
          <MenuItem key={c.id} onClick={() => { onAssign(menu.unit.id, c.id); setMenu(null); }}>
            <ListItemText primary={c.name} secondary={statuses[c.id]?.label} />
          </MenuItem>
        ))}
        {collection.cases.length > 0 && <Divider />}
        <MenuItem onClick={() => { onAssign(menu.unit.id, null); setMenu(null); }}>New case</MenuItem>
      </Menu>
    </Box>
  );
}

export default Shelf;
