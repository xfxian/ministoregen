import { Box, ButtonBase, Typography } from '@mui/material';
import { useState } from 'react';
import { tokens } from '../../theme';
import PlanDrawing from '../PlanDrawing';
import { UNIT_DRAG_TYPE } from './Shelf';

export const STATUS_STYLE = {
  ok: { color: tokens.ok, bg: tokens.okSoft },
  warning: { color: tokens.warn, bg: tokens.warnSoft },
  error: { color: tokens.error, bg: tokens.errorSoft },
  empty: { color: tokens.muted, bg: 'rgba(220,230,240,0.06)' },
};

export function StatusBadge({ status }) {
  const style = STATUS_STYLE[status.kind];
  return (
    <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 99, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: style.color, bgcolor: style.bg }}>
      {status.label}
    </Box>
  );
}

/** Accepts units dragged from the shelf. */
export function useUnitDrop(onDropUnit) {
  const [over, setOver] = useState(false);
  const accepts = (e) => e.dataTransfer.types.includes(UNIT_DRAG_TYPE);
  return {
    over,
    handlers: {
      onDragOver: (e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e) => {
        setOver(false);
        const unitId = e.dataTransfer.getData(UNIT_DRAG_TYPE);
        if (unitId) {
          e.preventDefault();
          onDropUnit(unitId);
        }
      },
    },
  };
}

/** A case on the board: plan drawing, contents and whether everything fits. */
function CaseCard({ caseItem, project, plan, status, selected, onSelect, onDropUnit }) {
  const { over, handlers } = useUnitDrop(onDropUnit);
  const fill = status.pockets ? Math.min(1, status.minis / status.pockets) : 0;
  return (
    <ButtonBase
      component="article"
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${caseItem.name}: ${plan.unitsX} by ${plan.unitsY}, ${status.label}`}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      {...handlers}
      sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 1.25, p: 2, textAlign: 'left',
        borderRadius: 1.5, bgcolor: over ? tokens.accentSoft : tokens.panel,
        border: `1px solid ${selected || over ? tokens.accent : tokens.line}`,
        boxShadow: selected ? `inset 0 0 0 1px ${tokens.accent}` : 'none',
        transition: 'border-color 120ms, background-color 120ms',
        '&:hover': { borderColor: selected ? tokens.accent : tokens.lineStrong },
        '&.Mui-focusVisible': { outline: `2px solid ${tokens.accent}`, outlineOffset: 2 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography component="h3" sx={{ fontSize: 18, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{caseItem.name}</Typography>
        <Typography sx={{ fontFamily: tokens.mono, fontSize: 12, color: tokens.muted, whiteSpace: 'nowrap' }}>
          {plan.unitsX} × {plan.unitsY} · {plan.heightUnits} u
        </Typography>
        <Box sx={{ ml: 'auto' }}><StatusBadge status={status} /></Box>
      </Box>
      <Box sx={{ height: 150, borderRadius: 1, bgcolor: '#0e1318', p: 1 }}>
        {status.kind === 'empty' ? (
          <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: tokens.muted, fontSize: 14, textAlign: 'center' }}>
            Drop a unit here
          </Box>
        ) : (
          <PlanDrawing project={project} plan={plan} label={`Top view of ${caseItem.name}`} />
        )}
      </Box>
      <Box sx={{ height: 6, borderRadius: 3, bgcolor: tokens.line }} aria-hidden="true">
        <Box sx={{ width: `${fill * 100}%`, height: '100%', borderRadius: 3, bgcolor: STATUS_STYLE[status.kind].color }} />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {project.groups.map((g) => (
          <Box key={g.id} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.25, borderRadius: 99, fontSize: 13, bgcolor: tokens.raised, border: `1px solid ${tokens.line}` }}>
            <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: g.color }} />
            {g.name} ×{g.count}
          </Box>
        ))}
      </Box>
    </ButtonBase>
  );
}

export default CaseCard;
