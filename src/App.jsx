import { Download, LibraryBooks, Redo, Save, Share, Undo } from '@mui/icons-material';
import {
  Box, Button, CssBaseline, IconButton, Snackbar, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CollectionView from './components/collection/CollectionView';
import LibraryDialog from './components/LibraryDialog';
import SharedCollectionDialog from './components/SharedCollectionDialog';
import SingleView from './components/SingleView';
import {
  buildPrintFiles, designCode, downloadBlob, shortHash, printName, slugify, zipFiles,
} from './export';
import { loadManifold } from './geometry/manifoldLoader';
import { addCollection, caseProject, caseStatus, removeCase } from './model/collection';
import { planProject } from './model/layout';
import { isDefaultProject, makeDefaultProject } from './model/project';
import { saveDesign } from './state/library';
import { useCollection } from './state/useCollection';
import {
  LONG_LINK, binLink, collectionLink, copyLink, readShareLink,
} from './state/shareLink';
import { useProject } from './state/useProject';
import { theme, tokens } from './theme';
import { versionInfo } from './version';

const MODE_KEY = 'ministoregen.mode';
const VERSION = versionInfo();

function initialMode(shared) {
  if (shared?.kind === 'bin') return 'single';
  try {
    return window.localStorage.getItem(MODE_KEY) === 'single' ? 'single' : 'collection';
  } catch {
    return 'collection';
  }
}

function downloadFiles(files, zipName) {
  if (files.length === 1) downloadBlob(new Blob([files[0].data], { type: 'model/stl' }), files[0].name);
  else downloadBlob(zipFiles(files), zipName);
}

/**
 * `shared` is what the page was opened with: a share link read by readShareLink
 * (a collection or a single bin), an error for a broken link, or null.
 */
function App({ shared = null }) {
  const [mode, setMode] = useState(() => initialMode(shared));
  const single = useProject(mode === 'single', shared?.kind === 'bin' ? shared.value : null);
  const coll = useCollection();
  const active = mode === 'single' ? single : coll;
  const { project } = single;
  const { collection } = coll;
  const plan = useMemo(() => planProject(project), [project]);
  const cases = useMemo(() => collection.cases.map((caseItem) => {
    const p = caseProject(collection, caseItem);
    const casePlan = planProject(p);
    return { caseItem, project: p, plan: casePlan, status: caseStatus(casePlan) };
  }), [collection]);

  const [selectedId, setSelectedId] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryId, setLibraryId] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [toast, setToast] = useState(() => (shared?.error ? { text: shared.error, key: 0 } : null));
  const [sharedCollection, setSharedCollection] = useState(shared?.kind === 'collection' ? shared.value : null);
  const compact = useMediaQuery('(max-width: 699.95px)');

  const notify = useCallback((text, undoable = false) => setToast({ text, undoable, key: Date.now() }), []);

  const switchMode = (next) => {
    if (!next || next === mode) return;
    setMode(next);
    setToast(null);
    try { window.localStorage.setItem(MODE_KEY, next); } catch { /* storage unavailable */ }
    if (next === 'collection') window.history.replaceState(null, '', window.location.pathname + window.location.search);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      if (e.target instanceof HTMLElement && e.target.matches('input, textarea')) return;
      e.preventDefault();
      if (e.shiftKey) active.redo(); else active.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  /** Builds print files off the current frame so the button can show progress first. */
  const runExport = (id, build) => {
    setExporting(id);
    setTimeout(async () => {
      try {
        const wasm = await loadManifold();
        build(wasm);
      } catch {
        notify('Export failed. Please try again.');
      } finally {
        setExporting(null);
      }
    }, 30);
  };

  const exportSingle = () => runExport('single', (wasm) => {
    const base = printName(project.name, project, plan);
    downloadFiles(buildPrintFiles(wasm, project, plan, base), `${base}.zip`);
  });

  const exportCase = (c) => runExport(c.caseItem.id, (wasm) => {
    const base = printName(c.caseItem.name, c.project, c.plan);
    downloadFiles(buildPrintFiles(wasm, c.project, c.plan, base), `${base}.zip`);
  });

  const printable = cases.filter((c) => c.status.kind !== 'empty');
  const exportAll = () => runExport('all', (wasm) => {
    const files = printable.flatMap((c) => buildPrintFiles(wasm, c.project, c.plan, printName(c.caseItem.name, c.project, c.plan)));
    const code = shortHash(printable.map((c) => designCode(c.project)).join());
    downloadBlob(zipFiles(files), `${slugify(collection.name)}-${printable.length}-cases-${code}.zip`);
    const problems = printable.filter((c) => c.status.kind === 'error' || c.status.kind === 'warning');
    if (problems.length) notify(`Exported. Check ${problems.map((c) => c.caseItem.name).join(', ')}: not everything fits.`);
  });

  const share = async (link, what) => {
    const url = link();
    if (!(await copyLink(url))) return;
    const { length } = await url;
    notify(length > LONG_LINK
      ? `Link copied. It is very long (${length.toLocaleString('en')} characters); if an app cuts it off, use a backup file instead.`
      : `Link copied. It opens ${what} for anyone.`);
  };
  const shareBin = (p) => share(() => binLink(p), 'as a single bin');

  // A collection link leaves the address once read, so a reload does not ask again.
  useEffect(() => {
    if (shared?.kind === 'collection' || shared?.error) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [shared]);

  // A link pasted into a tab that already has the app open only changes the hash.
  const { replace: replaceSingle } = single;
  useEffect(() => {
    const onHash = async () => {
      const link = await readShareLink(window.location.hash);
      if (!link) return;
      if (link.kind !== 'bin') window.history.replaceState(null, '', window.location.pathname + window.location.search);
      if (link.error) notify(link.error);
      else if (link.kind === 'collection') setSharedCollection(link.value);
      else {
        replaceSingle({ ...link.value, preview: project.preview });
        setMode('single');
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [notify, replaceSingle, project.preview]);

  const openSharedCollection = (how) => {
    const incoming = sharedCollection;
    setSharedCollection(null);
    if (how === 'cancel') return;
    coll.replace(how === 'replace'
      ? { ...incoming, preview: collection.preview }
      : addCollection(collection, incoming));
    switchMode('collection');
    notify(how === 'replace' ? `Opened "${incoming.name}". Undo brings yours back.` : `Added the units and cases from "${incoming.name}".`, true);
  };

  const saveSingle = () => {
    try {
      const id = saveDesign(project, libraryId ?? undefined);
      setLibraryId(id);
      notify(`Saved "${project.name}" to the library.`);
    } catch {
      notify('Could not save: browser storage is unavailable.');
    }
  };

  const deleteCase = (caseItem) => {
    coll.update(removeCase(caseItem.id), { commit: true });
    notify(`${caseItem.name} deleted. Its minis are back on the shelf.`, true);
  };

  const iconButton = (title, label, icon, onClick, disabled = false) => (
    <Tooltip title={title}>
      <span><IconButton size={compact ? 'small' : 'medium'} onClick={onClick} disabled={disabled} aria-label={label}>{icon}</IconButton></span>
    </Tooltip>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', bgcolor: tokens.bg, color: tokens.text }}>
        <Box
          component="header"
          sx={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: { xs: 0.25, sm: 1.5 }, rowGap: 1,
            px: { xs: 1.5, md: 3 }, py: 1, bgcolor: tokens.panel, borderBottom: `1px solid ${tokens.line}`,
          }}
        >
          <Typography component="span" sx={{ fontFamily: tokens.mono, fontWeight: 700, letterSpacing: { xs: '0.08em', sm: '0.14em' }, fontSize: { xs: 12, md: 15 }, mr: { xs: 1, md: 1 } }}>
            MINISTOREGEN
          </Typography>
          <Typography
            component={VERSION.url ? 'a' : 'span'}
            href={VERSION.url ?? undefined}
            target={VERSION.url ? '_blank' : undefined}
            rel={VERSION.url ? 'noopener noreferrer' : undefined}
            title={VERSION.title}
            data-testid="app-version"
            sx={{ fontFamily: tokens.mono, fontSize: 11, color: tokens.muted, textDecoration: 'none', ml: { xs: -0.75, md: -1 }, mr: { xs: 1, md: 1 }, '&:hover': VERSION.url ? { color: tokens.text, textDecoration: 'underline' } : undefined }}
          >
            {VERSION.label}
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            onChange={(_, v) => switchMode(v)}
            aria-label="Mode"
            sx={{ order: { xs: 3, sm: 0 }, flexBasis: { xs: '100%', sm: 'auto' }, '& .MuiToggleButton-root': { px: 1.75, flex: { xs: 1, sm: 'none' } } }}
          >
            <ToggleButton value="collection">My collection</ToggleButton>
            <ToggleButton value="single">Single bin</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ flex: 1 }} />
          {iconButton('Undo (Ctrl+Z)', 'Undo', <Undo />, active.undo, !active.canUndo)}
          {iconButton('Redo (Ctrl+Shift+Z)', 'Redo', <Redo />, active.redo, !active.canRedo)}
          {mode === 'single' && iconButton(libraryId ? 'Save changes to the library' : 'Save to the library', 'Save', <Save />, saveSingle)}
          {mode === 'single'
            ? iconButton('Copy a link to this bin', 'Share', <Share />, () => shareBin(project))
            : iconButton('Copy a link to your whole collection', 'Share collection', <Share />, () => share(() => collectionLink(collection), 'your whole collection'), !collection.units.length)}
          {compact
            ? iconButton('Library and backup', 'Library', <LibraryBooks />, () => setLibraryOpen(true))
            : <Button startIcon={<LibraryBooks />} onClick={() => setLibraryOpen(true)} sx={{ color: tokens.text }} aria-label="Library">Library</Button>}
          {mode === 'single' ? (
            <Button
              variant="contained"
              startIcon={compact ? undefined : <Download />}
              onClick={exportSingle}
              disabled={exporting === 'single' || !project.groups.length}
              aria-label="Export STL"
              sx={compact ? { minWidth: 44, px: 1, ml: 0.5 } : undefined}
            >
              {compact ? <Download /> : exporting === 'single' ? 'Building…' : 'Export STL'}
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={compact ? undefined : <Download />}
              onClick={exportAll}
              disabled={exporting === 'all' || !printable.length}
              aria-label="Export all cases"
              sx={compact ? { minWidth: 44, px: 1, ml: 0.5 } : undefined}
            >
              {compact ? <Download /> : exporting === 'all' ? 'Building…' : `Export all${printable.length ? ` (${printable.length})` : ''}`}
            </Button>
          )}
        </Box>

        <Box sx={{ flex: 1, minHeight: 0 }}>
          {mode === 'single' ? (
            <SingleView project={project} plan={plan} update={single.update} onSwitchToCollection={() => switchMode('collection')} />
          ) : (
            <CollectionView
              collection={collection}
              update={coll.update}
              cases={cases}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onExportCase={exportCase}
              onShareCase={(c) => shareBin({ ...c.project, name: c.caseItem.name })}
              onDeleteCase={deleteCase}
              exportingId={exporting}
              singleProject={project}
              onSwitchToSingle={() => switchMode('single')}
              onToast={notify}
            />
          )}
        </Box>
      </Box>

      <LibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        currentId={libraryId}
        collection={collection}
        project={project}
        onRestore={({ collection: restored, project: restoredProject }) => {
          const replacing = [
            restored && (collection.units.length > 0 || collection.cases.length > 0) && 'collection',
            restoredProject && !isDefaultProject(project) && 'single bin',
          ].filter(Boolean);
          if (replacing.length && !window.confirm(`Replace your current ${replacing.join(' and ')} with the backup?`)) return false;
          if (restored) coll.replace({ ...restored, preview: collection.preview });
          if (restoredProject) single.replace({ ...restoredProject, preview: project.preview });
          return true;
        }}
        onOpenDesign={(d) => { single.replace(d.project); setLibraryId(d.id); setLibraryOpen(false); switchMode('single'); }}
        onNewDesign={() => { single.replace(makeDefaultProject()); setLibraryId(null); setLibraryOpen(false); switchMode('single'); }}
      />
      <SharedCollectionDialog
        collection={sharedCollection}
        hasOwn={collection.units.length > 0 || collection.cases.length > 0}
        onChoose={openSharedCollection}
      />
      <Snackbar
        key={toast?.key}
        open={Boolean(toast)}
        autoHideDuration={toast?.undoable ? 6000 : 4000}
        onClose={(_, reason) => { if (reason !== 'clickaway') setToast(null); }}
        message={toast?.text}
        action={toast?.undoable && <Button color="primary" size="small" onClick={() => { active.undo(); setToast(null); }}>Undo</Button>}
      />
    </ThemeProvider>
  );
}

export default App;
