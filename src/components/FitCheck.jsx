import { CheckCircleOutline, ErrorOutline, WarningAmber } from '@mui/icons-material';
import { Button, Stack, Typography } from '@mui/material';
import { patchBin } from '../state/updates';

function FitCheck({ plan, onUpdate }) {
  const minis = plan.strips.reduce((n, s) => n + s.group.count, 0);
  const pockets = plan.strips.reduce((n, s) => n + s.capacity, 0);
  if (!plan.warnings.length) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" data-testid="fit-ok">
        <CheckCircleOutline color="success" fontSize="small" />
        <Typography variant="body2">
          {minis === 0 ? 'Nothing to store yet.' : `All ${minis} miniatures fit${pockets > minis ? `, ${pockets - minis} spare pockets` : ''}.`}
        </Typography>
      </Stack>
    );
  }
  return (
    <Stack spacing={1.5}>
      {plan.warnings.map((w) => (
        <Stack key={w.id} direction="row" spacing={1} alignItems="flex-start">
          {w.severity === 'error' ? <ErrorOutline color="error" fontSize="small" /> : <WarningAmber color="warning" fontSize="small" />}
          <div>
            <Typography variant="body2">{w.text}</Typography>
            {w.fix && (
              <Button size="small" sx={{ px: 0, minWidth: 0 }} onClick={() => onUpdate(patchBin(w.fix.bin))}>{w.fix.label}</Button>
            )}
          </div>
        </Stack>
      ))}
    </Stack>
  );
}

export default FitCheck;
