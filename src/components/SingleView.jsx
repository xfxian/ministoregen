import { Box, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { setName } from '../state/updates';
import { gridPaper, overline, tokens } from '../theme';
import AdvancedSettings from './AdvancedSettings';
import BinStep from './BinStep';
import FitCheck from './FitCheck';
import GroupsStep from './GroupsStep';
import ModelView from './ModelView';
import TitleBlock from './TitleBlock';

function Step({ number, title, children }) {
  return (
    <Box component="section" sx={{ px: 2.5, py: 2.25, borderBottom: `1px solid ${tokens.line}` }}>
      <Typography component="h2" sx={{ ...overline, mb: 1.5 }}>
        <Box component="span" sx={{ color: tokens.accentText, mr: 1 }}>{number}</Box>{title}
      </Typography>
      {children}
    </Box>
  );
}

/** Single-bin mode: describe one bin and export it. No collection involved. */
function SingleView({ project, plan, update, onSwitchToCollection }) {
  const [highlightId, setHighlightId] = useState(null);
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, overflowY: { xs: 'auto', md: 'hidden' } }}>
      <Box sx={{ flex: { md: '0 0 420px' }, overflowY: { md: 'auto' }, bgcolor: tokens.panel, borderRight: { md: `1px solid ${tokens.line}` }, order: { xs: 2, md: 1 } }}>
        <Box sx={{ px: 2.5, pt: 2.5, pb: 2, borderBottom: `1px solid ${tokens.line}` }}>
          <Typography sx={overline}>Single bin</Typography>
          <TextField
            variant="standard"
            fullWidth
            value={project.name}
            onChange={(e) => update(setName(e.target.value))}
            inputProps={{ 'aria-label': 'Design name', maxLength: 80, style: { fontSize: 24, fontWeight: 700 } }}
            sx={{ mt: 0.5 }}
          />
          <Typography variant="body2" sx={{ color: tokens.muted, mt: 1 }}>
            List what goes in and export. Storing a whole army?{' '}
            <Box component="button" type="button" onClick={onSwitchToCollection} sx={{ font: 'inherit', color: tokens.accentText, background: 'none', border: 0, p: 0, cursor: 'pointer', textDecoration: 'underline' }}>
              Use My collection
            </Box>
          </Typography>
        </Box>
        <Step number="1" title="What goes in">
          <GroupsStep project={project} plan={plan} onUpdate={update} onHover={setHighlightId} />
        </Step>
        <Step number="2" title="Bin">
          <BinStep project={project} plan={plan} onUpdate={update} />
        </Step>
        <Step number="3" title="Fit check">
          <FitCheck plan={plan} onUpdate={update} />
        </Step>
        <Box sx={{ px: 2.5, pb: 2 }}>
          <AdvancedSettings project={project} onUpdate={update} />
        </Box>
      </Box>
      <Box component="main" sx={{ flex: { md: '1 1 auto' }, minWidth: 0, p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2, order: { xs: 1, md: 2 }, ...gridPaper }}>
        <Box sx={{ flex: { md: 1 }, height: { xs: 340, md: 'auto' }, minHeight: 0 }}>
          <ModelView project={project} plan={plan} onUpdate={update} highlightId={highlightId} minHeight={0} />
        </Box>
        <TitleBlock project={project} plan={plan} />
      </Box>
    </Box>
  );
}

export default SingleView;
