import { Add, DeleteOutline, Download, Link as LinkIcon, Remove } from '@mui/icons-material';
import {
  Box, Button, Divider, IconButton, ListItemText, Menu, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { useState } from 'react';
import {
  assignRemaining, assignedCount, caseGroupId, modelLabel, patchCase, setItemCount, unassigned, updateCaseSettings,
} from '../../model/collection';
import { overline, tokens } from '../../theme';
import AdvancedSettings from '../AdvancedSettings';
import BinStep from '../BinStep';
import FitCheck from '../FitCheck';
import ModelView from '../ModelView';
import TitleBlock from '../TitleBlock';
import { StatusBadge } from './CaseCard';

function Section({ title, children, action }) {
  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 32 }}>
        <Typography component="h3" sx={overline}>{title}</Typography>
        <Box sx={{ ml: 'auto' }}>{action}</Box>
      </Box>
      {children}
    </Box>
  );
}

/** Everything about the selected case: drawing, contents, fit check and bin settings. */
function CaseDetail({ collection, caseItem, project, plan, status, onUpdate, onExport, onShare, onDelete, exporting }) {
  const [addMenu, setAddMenu] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const waiting = unassigned(collection);
  const settings = (recipe) => onUpdate(updateCaseSettings(caseItem.id, recipe));

  return (
    <Stack spacing={2.5} sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <TextField
          variant="standard"
          value={caseItem.name}
          onChange={(e) => onUpdate(patchCase(caseItem.id, { name: e.target.value }))}
          inputProps={{ 'aria-label': 'Case name', maxLength: 60, style: { fontSize: 22, fontWeight: 700 } }}
          sx={{ flex: '1 1 160px', minWidth: 0 }}
        />
        <StatusBadge status={status} />
        <Tooltip title="Copy a link to this case as a single bin">
          <IconButton onClick={onShare} aria-label={`Share ${caseItem.name}`}><LinkIcon /></IconButton>
        </Tooltip>
        <Tooltip title="Delete case (its minis go back to the shelf)">
          <IconButton onClick={onDelete} aria-label={`Delete ${caseItem.name}`}><DeleteOutline /></IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<Download />} onClick={onExport} disabled={status.kind === 'empty' || exporting}>
          {exporting ? 'Building…' : 'Export'}
        </Button>
      </Box>

      <Box sx={{ height: { xs: 300, md: 340 } }}>
        <ModelView project={project} plan={plan} onUpdate={settings} highlightId={highlightId} minHeight={0} />
      </Box>
      <TitleBlock project={project} plan={plan} />

      <Section
        title="In this case"
        action={waiting.length > 0 && (
          <Button size="small" startIcon={<Add />} onClick={(e) => setAddMenu(e.currentTarget)}>Add from shelf</Button>
        )}
      >
        {caseItem.items.length === 0 && (
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            Nothing here yet. Add units from the shelf or drag them onto the case.
          </Typography>
        )}
        {caseItem.items.map((item) => {
          const unit = collection.units.find((u) => u.id === item.unitId);
          const model = unit?.models.find((m) => m.id === item.modelId);
          if (!model) return null;
          const name = modelLabel(unit, model);
          const max = model.count - assignedCount(collection, unit.id, model.id, caseItem.id);
          const groupId = caseGroupId(unit.id, model.id);
          return (
            <Box
              key={groupId}
              onMouseEnter={() => setHighlightId(groupId)}
              onMouseLeave={() => setHighlightId(null)}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}
            >
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: model.color, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Typography>
                <Typography sx={{ fontFamily: tokens.mono, fontSize: 12, color: tokens.muted }}>
                  {item.count} of {model.count}{max > item.count ? ` · ${max - item.count} more on the shelf` : ''}
                </Typography>
              </Box>
              <IconButton size="small" aria-label={`One less ${name}`} onClick={() => onUpdate(setItemCount(caseItem.id, unit.id, model.id, item.count - 1))}>
                <Remove fontSize="small" />
              </IconButton>
              <Typography sx={{ fontFamily: tokens.mono, width: 28, textAlign: 'center' }} aria-live="polite">{item.count}</Typography>
              <IconButton size="small" aria-label={`One more ${name}`} disabled={item.count >= max} onClick={() => onUpdate(setItemCount(caseItem.id, unit.id, model.id, item.count + 1))}>
                <Add fontSize="small" />
              </IconButton>
            </Box>
          );
        })}
      </Section>

      <Section title="Fit check">
        <FitCheck plan={plan} onUpdate={settings} />
      </Section>

      <Divider />
      <Section title="Bin">
        <BinStep project={project} plan={plan} onUpdate={settings} />
        <AdvancedSettings project={project} onUpdate={settings} />
      </Section>

      <Menu anchorEl={addMenu} open={Boolean(addMenu)} onClose={() => setAddMenu(null)}>
        {waiting.map(({ unit, model, count }) => (
          <MenuItem key={caseGroupId(unit.id, model.id)} onClick={() => { onUpdate(assignRemaining(caseItem.id, unit.id, model.id), { commit: true }); setAddMenu(null); }}>
            <ListItemText primary={modelLabel(unit, model)} secondary={`${count} waiting`} />
          </MenuItem>
        ))}
      </Menu>
    </Stack>
  );
}

export default CaseDetail;
