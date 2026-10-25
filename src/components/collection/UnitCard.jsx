import { Box, ButtonBase, Typography } from '@mui/material';
import { unitPlacement } from '../../model/collection';
import { tokens } from '../../theme';
import BaseSketch, { baseLabel } from './BaseSketch';

const SHAPE_WORDS = { round: 'round', oval: 'oval', square: 'square', rect: 'rectangular' };

function placementText(collection, unit) {
  const placed = unitPlacement(collection, unit.id);
  const stored = placed.reduce((n, p) => n + p.count, 0);
  const waiting = unit.count - stored;
  if (!placed.length) return { text: 'Not in a case yet', tone: 'waiting' };
  const where = placed.length === 1 ? placed[0].case.name : `${placed.length} cases`;
  if (!waiting) return { text: placed.length === 1 && unit.count > 1 ? `All in ${where}` : `In ${where}`, tone: 'ok' };
  return { text: `${stored} in ${where} · ${waiting} waiting`, tone: 'waiting' };
}

/** One unit of the collection as a card; opens the editor when clicked. */
function UnitCard({ collection, unit, onOpen }) {
  const status = placementText(collection, unit);
  return (
    <ButtonBase
      onClick={() => onOpen(unit.id)}
      aria-label={`Edit ${unit.name}`}
      sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 1, p: 1.75, textAlign: 'left',
        borderRadius: 1.25, bgcolor: tokens.panel,
        border: `1px ${status.tone === 'waiting' ? 'dashed' : 'solid'} ${status.tone === 'waiting' ? tokens.accent : tokens.line}`,
        transition: 'border-color 120ms, background-color 120ms',
        '&:hover': { bgcolor: tokens.raised, borderColor: status.tone === 'waiting' ? tokens.accent : tokens.lineStrong },
        '&.Mui-focusVisible': { outline: `2px solid ${tokens.accent}`, outlineOffset: 2 },
      }}
    >
      <BaseSketch unit={unit} height={72} />
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
        <Typography component="h3" sx={{ fontSize: { xs: 16, sm: 18 }, fontWeight: 700, lineHeight: 1.2, minWidth: 0, overflowWrap: 'break-word', hyphens: 'auto' }}>{unit.name || 'Unnamed'}</Typography>
        <Typography sx={{ fontFamily: tokens.mono, fontSize: 20, fontWeight: 700, flexShrink: 0 }}>×{unit.count}</Typography>
      </Box>
      <Typography sx={{ fontFamily: tokens.mono, fontSize: 12, color: tokens.muted }}>
        {baseLabel(unit)} {SHAPE_WORDS[unit.shape]} · {unit.heightMm} mm tall{unit.overhang > 0 ? ` · +${unit.overhang} mm overhang` : ''}
      </Typography>
      <Typography sx={{ fontSize: 13, color: status.tone === 'ok' ? tokens.ok : tokens.accentText }}>{status.text}</Typography>
    </ButtonBase>
  );
}

export default UnitCard;
