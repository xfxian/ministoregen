import { Box } from '@mui/material';
import { LIP_HEIGHT, LIP_TIP } from '../geometry/gridfinity';
import { overline, tokens } from '../theme';

/** Key facts of a design in the style of a drawing's title block. */
function TitleBlock({ project, plan }) {
  const minis = plan.strips.reduce((n, s) => n + s.group.count, 0);
  const pockets = plan.strips.reduce((n, s) => n + s.capacity, 0);
  const total = plan.heightMm + (project.bin.lip ? LIP_HEIGHT - LIP_TIP : 0);
  const cells = [
    ['Grid', `${plan.unitsX} × ${plan.unitsY}`],
    ['Height', `${plan.heightUnits} u · ${total.toFixed(1)} mm`],
    ['Pockets', project.layout.pocketMode === 'floor' ? 'In the floor' : 'Drop-in inlay'],
    ['Fill', `${Math.min(minis, pockets)} / ${pockets}`],
  ];
  return (
    <Box
      data-testid="title-block"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
        border: `1px solid ${tokens.lineStrong}`,
        borderRadius: 1,
        fontFamily: tokens.mono,
        fontSize: 13,
        '& > div': { p: 1, borderRight: `1px solid ${tokens.line}`, borderBottom: { xs: `1px solid ${tokens.line}`, sm: 0 } },
        '& > div:last-of-type': { borderRight: 0 },
      }}
    >
      {cells.map(([k, v]) => (
        <div key={k}>
          <Box component="span" sx={{ ...overline, fontSize: 11, display: 'block' }}>{k}</Box>
          {v}
        </div>
      ))}
    </Box>
  );
}

export default TitleBlock;
