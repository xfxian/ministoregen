import { Box, ButtonBase, Typography } from '@mui/material';
import { unitPlacement, unitTotal } from '../../model/collection';
import { tokens } from '../../theme';
import BaseSketch, { baseLabel } from './BaseSketch';

const SHAPE_WORDS = { round: 'round', oval: 'oval', square: 'square', rect: 'rectangular' };

function placementText(collection, unit) {
  const placed = unitPlacement(collection, unit.id);
  const stored = placed.reduce((n, p) => n + p.count, 0);
  const total = unitTotal(unit);
  const waiting = total - stored;
  if (!placed.length) return { text: 'Not in a case yet', tone: 'waiting' };
  const where = placed.length === 1 ? placed[0].case.name : `${placed.length} cases`;
  if (!waiting) return { text: placed.length === 1 && total > 1 ? `All in ${where}` : `In ${where}`, tone: 'ok' };
  return { text: `${stored} in ${where} · ${waiting} waiting`, tone: 'waiting' };
}

function modelText(model) {
  return `${baseLabel(model)} ${SHAPE_WORDS[model.shape]} · ${model.heightMm} mm tall${model.overhang > 0 ? ` · +${model.overhang} mm overhang` : ''}`;
}

/** One unit of the collection as a card, with a sketch per model; opens the editor when clicked. */
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
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {unit.models.map((m) => <Box key={m.id} sx={{ flex: 1, minWidth: 0 }}><BaseSketch model={m} height={72} /></Box>)}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
        <Typography component="h3" sx={{ fontSize: { xs: 16, sm: 18 }, fontWeight: 700, lineHeight: 1.2, minWidth: 0, overflowWrap: 'break-word', hyphens: 'auto' }}>{unit.name || 'Unnamed'}</Typography>
        <Typography sx={{ fontFamily: tokens.mono, fontSize: 20, fontWeight: 700, flexShrink: 0 }}>×{unitTotal(unit)}</Typography>
      </Box>
      {unit.models.length === 1 ? (
        <Typography sx={{ fontFamily: tokens.mono, fontSize: 12, color: tokens.muted }}>{modelText(unit.models[0])}</Typography>
      ) : unit.models.map((m) => (
        <Typography key={m.id} sx={{ fontFamily: tokens.mono, fontSize: 12, color: tokens.muted, display: 'flex', gap: 0.75 }}>
          <Box component="span" sx={{ width: 8, height: 8, mt: '5px', borderRadius: '50%', bgcolor: m.color, flexShrink: 0 }} />
          <span>{m.count}× {m.name || 'Model'}: {modelText(m)}</span>
        </Typography>
      ))}
      <Typography sx={{ fontSize: 13, color: status.tone === 'ok' ? tokens.ok : tokens.accentText }}>{status.text}</Typography>
    </ButtonBase>
  );
}

export default UnitCard;
