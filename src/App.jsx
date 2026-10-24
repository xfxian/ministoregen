import {
  Download, LibraryBooks, Redo, Save, Share, Undo,
} from '@mui/icons-material';
import {
  AppBar, Box, Button, CssBaseline, Divider, IconButton, Menu, MenuItem, Snackbar, TextField, Toolbar, Tooltip,
  Typography, useMediaQuery,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useMemo, useRef, useState } from 'react';
import './App.css';
import AdvancedSettings from './components/AdvancedSettings';
import BinStep from './components/BinStep';
import FitCheck from './components/FitCheck';
import GroupsStep from './components/GroupsStep';
import LibraryDialog from './components/LibraryDialog';
import Viewport from './components/Viewport';
import { downloadStl, slugify } from './export';
import { planProject } from './model/layout';
import { makeDefaultProject } from './model/project';
import { saveDesign } from './state/library';
import { setName } from './state/updates';
import { shareUrl, useProject } from './state/useProject';

const theme = createTheme({
  palette: { mode: 'dark', background: { default: '#101317', paper: '#171b21' } },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
});

function Step({ number, title, children }) {
  return (
    <Box component="section" sx={{ px: 2, py: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        <Box component="span" sx={{ color: 'primary.main', mr: 1 }}>{number}</Box>{title}
      </Typography>
      {children}
    </Box>
  );
}

function App() {
  const { project, update, undo, redo, canUndo, canRedo } = useProject();
  const plan = useMemo(() => planProject(project), [project]);
  const [view, setView] = useState('3d');
  const [highlightId, setHighlightId] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryId, setLibraryId] = useState(null);
  const [downloadAnchor, setDownloadAnchor] = useState(null);
  const [toast, setToast] = useState(null);
  const binRef = useRef();
  const inlayRef = useRef();
  const isMobile = useMediaQuery('(max-width:900px)');

  const base = slugify(project.name);
  const download = (which) => {
    setDownloadAnchor(null);
    const ok = which === 'inlay'
      ? downloadStl(inlayRef.current, `${base}-inlay.stl`)
      : downloadStl(binRef.current, `${base}-bin.stl`);
    if (!ok) setToast('The model is still loading. Try again in a moment.');
  };

  const save = (asNew) => {
    try {
      const id = saveDesign(project, asNew ? undefined : libraryId ?? undefined);
      setLibraryId(id);
      setToast(`Saved "${project.name}" to the library.`);
    } catch {
      setToast('Could not save: browser storage is unavailable.');
    }
  };

  const share = async () => {
    const url = shareUrl(project);
    try {
      await navigator.clipboard.writeText(url);
      setToast('Link copied. Anyone with it can open this design.');
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const panel = (
    <Box sx={{ overflowY: 'auto', height: '100%' }}>
      <Step number="1" title="What are you storing?">
        <GroupsStep project={project} plan={plan} onUpdate={update} onHover={setHighlightId} />
      </Step>
      <Divider />
      <Step number="2" title="Bin">
        <BinStep project={project} plan={plan} onUpdate={update} />
      </Step>
      <Divider />
      <Step number="3" title="Fit check">
        <FitCheck plan={plan} onUpdate={update} />
      </Step>
      <Divider />
      <Box sx={{ px: 2, pb: 2 }}>
        <AdvancedSettings project={project} onUpdate={update} />
      </Box>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
        <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Toolbar variant="dense" sx={{ gap: 1, minHeight: 56 }}>
            {!isMobile && (
              <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ mr: 2 }}>Miniature Storage Generator</Typography>
            )}
            <TextField
              variant="standard"
              value={project.name}
              onChange={(e) => update(setName(e.target.value))}
              inputProps={{ 'aria-label': 'Design name' }}
              sx={{ flexGrow: 1, maxWidth: 320 }}
            />
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="Undo (Ctrl+Z)"><span><IconButton size="small" onClick={undo} disabled={!canUndo} aria-label="Undo"><Undo fontSize="small" /></IconButton></span></Tooltip>
            <Tooltip title="Redo (Ctrl+Shift+Z)"><span><IconButton size="small" onClick={redo} disabled={!canRedo} aria-label="Redo"><Redo fontSize="small" /></IconButton></span></Tooltip>
            <Tooltip title="Library"><IconButton size="small" onClick={() => setLibraryOpen(true)} aria-label="Library"><LibraryBooks fontSize="small" /></IconButton></Tooltip>
            <Tooltip title={libraryId ? 'Save changes to the library' : 'Save to the library'}>
              <IconButton size="small" onClick={() => save(false)} aria-label="Save"><Save fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Copy a link to this design"><IconButton size="small" onClick={share} aria-label="Share"><Share fontSize="small" /></IconButton></Tooltip>
            <Button
              variant="contained"
              size="small"
              startIcon={<Download />}
              onClick={(e) => (plan.inlay ? setDownloadAnchor(e.currentTarget) : download('bin'))}
              sx={{ ml: 1, whiteSpace: 'nowrap' }}
            >
              {isMobile ? 'STL' : 'Download STL'}
            </Button>
            <Menu anchorEl={downloadAnchor} open={Boolean(downloadAnchor)} onClose={() => setDownloadAnchor(null)}>
              <MenuItem onClick={() => download('bin')}>Bin</MenuItem>
              <MenuItem onClick={() => download('inlay')}>Inlay</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
          {isMobile ? (
            <>
              <Box sx={{ height: '45dvh', flexShrink: 0 }}>
                <Viewport project={project} plan={plan} view={view} onViewChange={setView} onUpdate={update} highlightId={highlightId} binRef={binRef} inlayRef={inlayRef} />
              </Box>
              <Box sx={{ flex: 1, minHeight: 0, borderTop: 1, borderColor: 'divider' }}>{panel}</Box>
            </>
          ) : (
            <>
              <Box sx={{ width: 400, flexShrink: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>{panel}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Viewport project={project} plan={plan} view={view} onViewChange={setView} onUpdate={update} highlightId={highlightId} binRef={binRef} inlayRef={inlayRef} />
              </Box>
            </>
          )}
        </Box>
      </Box>

      <LibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        currentId={libraryId}
        onOpenDesign={(d) => { update(d.project); setLibraryId(d.id); setLibraryOpen(false); }}
        onNewDesign={() => { update(makeDefaultProject()); setLibraryId(null); setLibraryOpen(false); }}
      />
      <Snackbar open={Boolean(toast)} autoHideDuration={3500} onClose={() => setToast(null)} message={toast} />
    </ThemeProvider>
  );
}

export default App;
