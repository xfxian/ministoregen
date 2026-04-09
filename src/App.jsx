import { Tune as TuneIcon } from '@mui/icons-material';
import {
  AppBar,
  Box,
  Button,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  Fab,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useRef, useState } from 'react';
import { Mesh } from 'three';
import { STLExporter } from 'three-stdlib';
import './App.css';
import { DEFAULT_BIN_CONFIG, DEFAULT_INLAY, DEFAULT_SECTION, DRAWER_WIDTH, GRIDFINITY_HEIGHT_UNIT } from './config';
import { calcBinHeightFromGroups, calcMinSectionLength, groupsToSections, snapToGridfinityHeight, snapToGridfinityLength } from './utils/wizardMath';
import ModelPreview from './ModelPreview';
import Sidebar from './components/Sidebar';
import SplitButton from './components/SplitButton';

function App() {
  const [modelConfig, setModelConfig] = useState({
    inlay: { ...DEFAULT_INLAY },
    base: {
      sections: [{ share: 100, ...DEFAULT_SECTION }]
    }
  });

  const handleInlayConfigChange = (field, value) => {
    setModelConfig((prev) => ({ ...prev, inlay: { ...prev.inlay, [field]: value } }));
  };

  const handleBaseSectionConfigChange = (section, field, value) => {
    setModelConfig((prev) => {
      const updated = prev.base.sections.map((s, i) =>
        i === section ? { ...s, [field]: value } : s
      );
      return { ...prev, base: { ...prev.base, sections: redistributeSectionShares(updated, section) } };
    });
  };

  const handleBaseSectionAdd = (afterIndex) => {
    setModelConfig((prev) => {
      const newSection = { share: prev.base.sections[afterIndex].share, ...DEFAULT_SECTION };
      const updated = [
        ...prev.base.sections.slice(0, afterIndex + 1),
        newSection,
        ...prev.base.sections.slice(afterIndex + 1),
      ];
      return { ...prev, base: { ...prev.base, sections: redistributeSectionShares(updated) } };
    });
  };

  const handleBaseSectionRemove = (removeIndex) => {
    setModelConfig((prev) => {
      const updated = prev.base.sections.filter((_, i) => i !== removeIndex);
      return { ...prev, base: { ...prev.base, sections: redistributeSectionShares(updated) } };
    });
    // Keep selectedSection in bounds
    setSelectedSection((prev) => {
      if (prev === null) return null;
      const newLength = modelConfig.base.sections.length - 1;
      return prev >= newLength ? Math.max(0, newLength - 1) : prev;
    });
  };

  const redistributeSectionShares = (sections, skipIndex = -1) => {
    const total = sections.reduce((sum, s) => sum + s.share, 0);
    const skipShare = sections[skipIndex]?.share || 0;
    return sections.map((s, i) => {
      if (i === skipIndex) return s;
      return { ...s, share: (s.share / (total - skipShare)) * (100 - skipShare) };
    });
  };

  const [binConfig, setBinConfig] = useState({ ...DEFAULT_BIN_CONFIG });
  const [binHeightUnit, setBinHeightUnit] = useState('mm');

  const handleBinConfigChange = (field, value) => {
    if (field === 'baseFeet' && miniatureGroups.length > 0) {
      setBinConfig((prev) => {
        const newConfig = { ...prev, [field]: value };
        const newHeight = calcBinHeightFromGroups(miniatureGroups, newConfig.floorThickness, newConfig.stackingLip);
        if (newHeight !== null) {
          newConfig.heightMm = value ? snapToGridfinityHeight(newHeight) : newHeight;
        }
        return newConfig;
      });
      setModelConfig((prev) => {
        const SPACING = 1, CLEARANCE = 0.4;
        const widthForCalc = prev.inlay.width - prev.inlay.clearance;
        const stripLengths = miniatureGroups.map((g) =>
          calcMinSectionLength(g.count, widthForCalc, g.baseSizeX, g.baseSizeY, SPACING, CLEARANCE, prev.inlay.margin)
        );
        const totalStrip = stripLengths.reduce((a, b) => a + b, 0);
        const rawLength = totalStrip + prev.inlay.clearance + 2 * prev.inlay.margin;
        const totalLength = value ? snapToGridfinityLength(rawLength) : rawLength;
        return { ...prev, inlay: { ...prev.inlay, length: totalLength } };
      });
      return;
    }
    setBinConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleBinHeightUnitChange = (value) => {
    setBinHeightUnit(value);
    if (value === 'u') {
      handleBinConfigChange(
        'heightMm',
        Math.round(binConfig.heightMm / GRIDFINITY_HEIGHT_UNIT) * GRIDFINITY_HEIGHT_UNIT || GRIDFINITY_HEIGHT_UNIT
      );
    }
  };

  const [previewConfig, setPreviewConfig] = useState({ wireframe: false, color: '#808080' });

  const [miniatureGroups, setMiniatureGroups] = useState([]);
  const [showMiniatureCylinders, setShowMiniatureCylinders] = useState(true);

  const handlePreviewConfigChange = (field, value) => {
    setPreviewConfig((prev) => ({ ...prev, [field]: value }));
  };

  const [inlayMode, setInlayMode] = useState('gridfinity');
  const [baseMode, setBaseMode] = useState('40k');

  const [selectedSection, setSelectedSection] = useState(0);

  // Mobile drawer
  const isMobile = useMediaQuery('(max-width:900px)');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Export alert
  const [openAlert, setOpenAlert] = useState(false);

  // Refs to access meshes
  const modelRef = useRef();
  const binRef = useRef();

  const exportMesh = (meshRef, filename) => {
    const mesh = meshRef.current;
    if (!mesh) { setOpenAlert(true); return false; }
    const tempMesh = new Mesh(mesh.geometry);
    const stlBinary = new STLExporter().parse(tempMesh, { binary: true });
    const blob = new Blob([stlBinary], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    return true;
  };

  const handleExportInlay = () => exportMesh(modelRef, 'inlay.stl');
  const handleExportBin = () => exportMesh(binRef, 'bin.stl');
  const handleExportBoth = () => {
    if (exportMesh(modelRef, 'inlay.stl')) {
      setTimeout(() => exportMesh(binRef, 'bin.stl'), 100);
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div className="App">
        <AppBar position="fixed" sx={{ zIndex: isMobile ? 'auto' : (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar variant={isMobile ? 'dense' : 'regular'}>
            <Typography
              variant={isMobile ? 'subtitle1' : 'h5'}
              noWrap
              component="div"
              sx={{ flexGrow: 1, fontWeight: 600 }}
            >
              {isMobile ? 'Storage Generator' : 'Miniature Storage Generator'}
            </Typography>
            <SplitButton
              onDownloadAll={handleExportBoth}
              onDownloadBin={handleExportBin}
              onDownloadInlay={handleExportInlay}
              binEnabled={binConfig.enabled}
              compact={isMobile}
            />
          </Toolbar>
        </AppBar>

        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? drawerOpen : true}
          onClose={() => setDrawerOpen(false)}
          sx={{
            width: isMobile ? '100vw' : DRAWER_WIDTH,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: isMobile ? '100vw' : DRAWER_WIDTH,
              boxSizing: 'border-box',
              overflowX: 'hidden',
              overflowY: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            },
          }}
        >
          {/* On desktop: spacer so content clears the fixed AppBar */}
          {!isMobile && <Toolbar />}
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: 'background.default' }}>
            <Sidebar
              modelConfig={modelConfig}
              binConfig={binConfig}
              binHeightUnit={binHeightUnit}
              previewConfig={previewConfig}
              inlayMode={inlayMode}
              baseMode={baseMode}
              selectedSection={selectedSection}
              isMobile={isMobile}
              miniatureGroups={miniatureGroups}
              showMiniatureCylinders={showMiniatureCylinders}
              onClose={() => setDrawerOpen(false)}
              onInlayConfigChange={handleInlayConfigChange}
              onBaseSectionConfigChange={handleBaseSectionConfigChange}
              onBaseSectionAdd={handleBaseSectionAdd}
              onBaseSectionRemove={handleBaseSectionRemove}
              onBinConfigChange={handleBinConfigChange}
              onBinHeightUnitChange={handleBinHeightUnitChange}
              onPreviewConfigChange={handlePreviewConfigChange}
              onInlayModeChange={setInlayMode}
              onBaseModeChange={setBaseMode}
              onSelectSection={setSelectedSection}
              onMiniatureGroupsChange={(groups) => {
                setMiniatureGroups(groups);
                const sections = groupsToSections(groups);
                if (sections) {
                  setModelConfig((prev) => {
                    const SPACING = 1, CLEARANCE = 0.4;
                    // hexagonalLayout receives widthWithClearance, not raw inlay.width
                    const widthForCalc = prev.inlay.width - prev.inlay.clearance;
                    // Each value is a *strip* length (what hexagonalLayout will receive).
                    // The caller must add clearance + 2×margin to get inlay.length.
                    const stripLengths = groups.map((g) =>
                      calcMinSectionLength(
                        g.count, widthForCalc,
                        g.baseSizeX, g.baseSizeY,
                        SPACING, CLEARANCE, prev.inlay.margin
                      )
                    );
                    const totalStrip = stripLengths.reduce((a, b) => a + b, 0);
                    const rawLength = totalStrip + prev.inlay.clearance + 2 * prev.inlay.margin;
                    const totalLength = binConfig.baseFeet ? snapToGridfinityLength(rawLength) : rawLength;
                    const sectionsWithLayout = sections.map((s, i) => ({
                      ...s,
                      share: (stripLengths[i] / totalStrip) * 100,
                    }));
                    return {
                      ...prev,
                      inlay: { ...prev.inlay, length: totalLength },
                      base: { ...prev.base, sections: sectionsWithLayout },
                    };
                  });
                  setBinConfig((prev) => {
                    const newHeight = calcBinHeightFromGroups(groups, prev.floorThickness, prev.stackingLip);
                    if (newHeight === null) return prev;
                    const snappedHeight = prev.baseFeet ? snapToGridfinityHeight(newHeight) : newHeight;
                    return { ...prev, heightMm: snappedHeight, enabled: true };
                  });
                }
              }}
              onShowMiniatureCylindersChange={setShowMiniatureCylinders}
            />
          </Box>
        </Drawer>

        {/* Mobile FAB to open sidebar */}
        {isMobile && (
          <Fab
            color="primary"
            sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1200 }}
            onClick={() => setDrawerOpen(true)}
          >
            <TuneIcon />
          </Fab>
        )}

        {/* Export error dialog */}
        <Dialog open={openAlert} onClose={() => setOpenAlert(false)}>
          <DialogTitle>Export Error</DialogTitle>
          <DialogContent>
            <DialogContentText>
              The mesh could not be found. Please ensure the 3D model is loaded correctly before exporting.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAlert(false)} autoFocus>OK</Button>
          </DialogActions>
        </Dialog>

        {/* Canvas */}
        <div className="canvas-container">
          <ModelPreview
            modelRef={modelRef}
            binRef={binRef}
            modelConfig={modelConfig}
            binConfig={binConfig}
            previewConfig={previewConfig}
            selectedSection={selectedSection}
            showMiniatureCylinders={showMiniatureCylinders}
          />
        </div>
      </div>
    </ThemeProvider>
  );
}

const darkTheme = createTheme({
  palette: { mode: 'dark' },
});

export default App;
