import { Box, ButtonBase, Typography } from '@mui/material';
import { useMemo } from 'react';
import { layoutOptions } from '../model/layout';
import { tokens } from '../theme';
import PlanDrawing from './PlanDrawing';

function spareText(plan) {
  const spare = plan.strips.reduce((n, s) => n + Math.max(0, s.capacity - s.group.count), 0);
  return spare ? `${spare} spare` : 'full';
}

/**
 * Bin sizes that hold everything, each with its top view, to pick from. The first is
 * the one the planner picks on its own; picking it turns automatic sizing back on.
 */
function LayoutChoices({ project, onChange }) {
  const { groups, bin, layout } = project;
  const options = useMemo(
    () => layoutOptions({ ...project, bin: { ...bin, autoFootprint: true } }),
    // Preview settings do not change the layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, bin, layout],
  );
  if (options.length < 2) return null;
  const chosen = bin.autoFootprint ? 0 : options.findIndex((o) => (o.unitsX === bin.unitsX && o.unitsY === bin.unitsY)
    || (o.unitsX === bin.unitsY && o.unitsY === bin.unitsX));

  return (
    <div>
      <Typography variant="overline" color="text.secondary" id="layout-choices">Layouts that fit</Typography>
      <Box
        role="radiogroup"
        aria-labelledby="layout-choices"
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 1 }}
      >
        {options.map((o, i) => {
          const selected = i === chosen;
          const label = `${o.unitsX} × ${o.unitsY}`;
          return (
            <ButtonBase
              key={label}
              role="radio"
              aria-checked={selected}
              aria-label={`${label} bin${i === 0 ? ', smallest' : ''}, ${spareText(o.plan)}`}
              onClick={() => onChange(i === 0 ? { autoFootprint: true } : { autoFootprint: false, unitsX: o.unitsX, unitsY: o.unitsY })}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0.5, p: 0.75, borderRadius: 1,
                border: `1px solid ${selected ? tokens.accent : tokens.line}`,
                bgcolor: selected ? tokens.raised : 'transparent',
                '&:hover': { borderColor: selected ? tokens.accent : tokens.lineStrong },
                '&.Mui-focusVisible': { outline: `2px solid ${tokens.accent}`, outlineOffset: 2 },
              }}
            >
              <Box sx={{ height: 72, pointerEvents: 'none' }}>
                <PlanDrawing project={o.project} plan={o.plan} label={`Top view of a ${label} bin`} />
              </Box>
              <Typography sx={{ fontFamily: tokens.mono, fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{label}</Typography>
              <Typography sx={{ fontFamily: tokens.mono, fontSize: 11, color: tokens.muted, textAlign: 'center', lineHeight: 1.4 }}>
                {i === 0 ? 'smallest' : `${o.unitsX * o.unitsY} cells`}<br />{spareText(o.plan)}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        Larger bins leave spare pockets or a squarer shape for your drawer.
      </Typography>
    </div>
  );
}

export default LayoutChoices;
