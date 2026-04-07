import { CircleOutlined, CropPortrait, Download, ExpandMore, Preview } from '@mui/icons-material';
import {
  Accordion,
  AccordionActions,
  AccordionDetails,
  AccordionSummary,
  AppBar,
  Box,
  Button,
  Chip,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  FormControlLabel,
  Grid2 as Grid,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { DRAWER_WIDTH, DEFAULT_SECTION, DEFAULT_INLAY, SELECT_ITEMS } from './config';
import ModelPreview from './ModelPreview';
import { useRef, useState } from 'react';
import { STLExporter } from 'three-stdlib';
import './App.css';

function App() {
  const [modelConfig, setModelConfig] = useState({
    inlay: { ...DEFAULT_INLAY },
    base: {
      sections: [{ share: 100, ...DEFAULT_SECTION }]
    }
  })

  const handleInlayConfigChange = (field, value) => {
    setModelConfig((prevConfig) => ({ ...prevConfig, inlay: { ...prevConfig.inlay, [field]: value } }))
  }

  const handleBaseSectionConfigChange = (section, field, value) => {
    setModelConfig((prevConfig) => {
      const updatedSections = prevConfig.base.sections.map((s, i) =>
        i === section ? { ...s, [field]: value } : s
      );
      return { ...prevConfig, base: { ...prevConfig.base, sections: redistributeSectionShares(updatedSections, section) } };
    })
  }

  const handleBaseSectionAdd = (afterSectionIndex) => {
    setModelConfig((prevConfig) => {
      const newSection = {
        share: prevConfig.base.sections[afterSectionIndex].share,
        ...DEFAULT_SECTION
      };
      const updatedSections = [
        ...prevConfig.base.sections.slice(0, afterSectionIndex + 1),
        newSection,
        ...prevConfig.base.sections.slice(afterSectionIndex + 1)
      ];
      return { ...prevConfig, base: { ...prevConfig.base, sections: redistributeSectionShares(updatedSections) } };
    })
  }

  const handleBaseSectionRemove = (removeSectionIndex) => {
    setModelConfig((prevConfig) => {
      const updatedSections = prevConfig.base.sections.filter((_, i) => i !== removeSectionIndex);
      return { ...prevConfig, base: { ...prevConfig.base, sections: redistributeSectionShares(updatedSections) } };
    })
  }

  const redistributeSectionShares = (sections, skipSectionIndex = -1) => {
    const totalShares = sections.map(section => section.share).reduce((prev, curr) => prev + curr);
    const skipSectionShare = sections[skipSectionIndex]?.share || 0;
    return sections.map((section, sectionIndex) => {
      if (sectionIndex === skipSectionIndex) return section;
      return { ...section, share: (section.share / (totalShares - skipSectionShare)) * (100 - skipSectionShare) };
    });
  }

  const [previewConfig, setPreviewConfig] = useState({
    wireframe: false,
    color: '#808080'
  })

  const handlePreviewConfigChange = (field, value) => {
    setPreviewConfig((prevConfig) => ({
      ...prevConfig,
      [field]: value
    }));
  };

  const labels = {
    modelConfig: {
      inlay: {
        length: {
          label: "Length",
          help: "Length of the inner side of your container"
        },
        width: {
          label: "Width",
          help: "Width of the inner side of your container"
        },
        cornerRadius: {
          label: "Corner Radius",
          help: "Radius of the inlay's rounded corners"
        },
        depth: {
          label: "Depth",
          help: "Extrusion depth of the inlay, giving it height"
        },
        margin: {
          label: "Margin",
          help: "Minimum amount of space between holes and the inlay's edge"
        },
        clearance: {
          label: "Printing Clearance",
          help: "To allow the inlay to snugly fit into your container"
        }
      },
      base: {
        share: {
          label: "Share",
          help: "Percentage of the inlay taken up by this section",
          unit: "%"
        },
        sizeX: {
          label: "Base Width",
          help: "Width of your miniature bases"
        },
        sizeY: {
          label: "Base Length",
          help: "Length of your miniature bases"
        },
        curvatureFactor: {
          label: "Curvature Factor",
          help: "Play with this factor to modify the curvature of the ellipse",
          unit: ""
        },
        spacing: {
          label: "Spacing",
          help: "Minimum amount of space between each base hole"
        },
        clearance: {
          label: "Printing Clearance",
          help: "To allow miniature bases to easily fit into the base holes"
        }
      }
    }
  }

  // Configuration Modes

  const [inlayMode, setInlayMode] = useState("gridfinity");
  const [baseMode, setBaseMode] = useState("40k");

  const isSelectItem = (mode, key) => SELECT_ITEMS[mode] && SELECT_ITEMS[mode][key] !== undefined

  const isGridfinityMode = inlayMode === "gridfinity";
  const is40kMode = baseMode === "40k";

  // State variable for controlling the modal alert
  const [openAlert, setOpenAlert] = useState(false);

  // Ref to access the mesh
  const modelRef = useRef();

  // Export function
  const handleExport = () => {
    const exporter = new STLExporter();
    const mesh = modelRef.current;

    if (!mesh) {
      setOpenAlert(true);
      return;
    }

    // Ensure the mesh's world matrix is up-to-date
    // @ts-ignore
    mesh.updateMatrixWorld(true);

    const stlBinary = exporter.parse(mesh, { binary: true });

    // Create and download the STL file
    const blob = new Blob([stlBinary], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'model.stl';
    link.click();
  };
  // Function to handle closing the modal alert
  const handleCloseAlert = () => {
    setOpenAlert(false);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div className="App">
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <Typography variant="h5" noWrap component="div" style={{ flexGrow: 1 }}>
              Miniature Storage Inlay Generator
            </Typography>
            <Button variant='outlined' color="inherit" startIcon={<Download />} onClick={handleExport}>
              Download STL
            </Button>
          </Toolbar>
        </AppBar>

        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              overflowX: 'hidden'
            },
          }}
        >
          <Toolbar />
          <Box
            sx={{ width: DRAWER_WIDTH, padding: 2, backgroundColor: 'background.default' }}
          >
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <CropPortrait sx={{ marginRight: 0.5 }} /><span>Inlay</span>
              </AccordionSummary>
              <AccordionDetails>
                <ToggleButtonGroup exclusive value={inlayMode} fullWidth onChange={(e, value) => setInlayMode(value)}>
                  <ToggleButton value="gridfinity">Gridfinity</ToggleButton>
                  <ToggleButton value="custom">Custom</ToggleButton>
                </ToggleButtonGroup>

                <Grid container spacing={2}>
                  {Object.entries(modelConfig.inlay).map(([key, value]) =>
                  (
                    <Grid size={6} key={`grid-inlay-${key}`}>
                      <TextField
                        label={labels.modelConfig.inlay[key]?.label || key}
                        helperText={labels.modelConfig.inlay[key]?.help}
                        type="number"
                        value={value}
                        onChange={(e) => handleInlayConfigChange(key, parseFloat(e.target.value) || 0)}
                        fullWidth
                        margin="normal"
                        variant="standard"
                        select={isGridfinityMode && isSelectItem("gridfinity", key)}
                        slotProps={{
                          input: {
                            endAdornment: <InputAdornment position="end" sx={{ marginRight: isGridfinityMode && isSelectItem("gridfinity", key) ? 3 : 0 }}>{isGridfinityMode && isSelectItem("gridfinity", key) ? SELECT_ITEMS['gridfinity'][key].unit : 'mm'}</InputAdornment>
                          }
                        }}
                      >
                        {isGridfinityMode && isSelectItem("gridfinity", key) && (
                          SELECT_ITEMS['gridfinity'][key].options.map(([value, description]) => (
                            <MenuItem key={`inlay-${key}-${value}`} value={value}>{description}</MenuItem>
                          ))
                        )}
                      </TextField>
                    </Grid>
                  )
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>

            {modelConfig.base.sections.map((section, sectionIndex) => (
              <Accordion defaultExpanded key={`section-${sectionIndex}`}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <CircleOutlined />
                      <span>Base</span>
                    </Stack>
                    <Chip label={`Section ${sectionIndex + 1}`} variant="outlined" color="primary" />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <ToggleButtonGroup exclusive value={baseMode} fullWidth onChange={(e, value) => setBaseMode(value)}>
                    <ToggleButton value="40k">40k</ToggleButton>
                    <ToggleButton value="custom">Custom</ToggleButton>
                  </ToggleButtonGroup>

                  <Grid container spacing={2}>
                    {Object.entries(section).map(([key, value]) =>
                    (
                      <Grid size={6} sx={{ marginBottom: 0 }} key={`box-base-${key}`}>
                        <TextField
                          label={labels.modelConfig.base[key]?.label || key}
                          helperText={labels.modelConfig.base[key]?.help}
                          type="number"
                          value={value}
                          onChange={(e) => handleBaseSectionConfigChange(sectionIndex, key, parseFloat(e.target.value) || 0)}
                          fullWidth
                          margin="normal"
                          variant="standard"
                          select={is40kMode && isSelectItem("40k", key)}
                          slotProps={{
                            input: {
                              endAdornment: <InputAdornment position="end" sx={{ marginRight: is40kMode && isSelectItem("40k", key) ? 3 : 0 }}>{is40kMode && isSelectItem("40k", key) ? SELECT_ITEMS['40k'][key].unit : (labels.modelConfig.base[key]?.unit || 'mm')}</InputAdornment>
                            }
                          }}
                        >
                          {is40kMode && isSelectItem("40k", key) && (
                            SELECT_ITEMS['40k'][key].options.map(([value, description]) => (
                              <MenuItem key={`base-${key}-${value}`} value={value}>{description}</MenuItem>
                            ))
                          )}
                        </TextField>
                      </Grid>
                    )
                    )}
                  </Grid>
                </AccordionDetails>
                <AccordionActions>
                  {(sectionIndex === (modelConfig.base.sections.length - 1) && (
                    <Button onClick={() => handleBaseSectionAdd(sectionIndex)}>Add</Button>
                  ))}
                  <Button onClick={() => handleBaseSectionRemove(sectionIndex)}>Remove</Button>
                </AccordionActions>
              </Accordion>
            ))}

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Preview sx={{ marginRight: 0.5 }} />Preview
              </AccordionSummary>
              <AccordionDetails>
                {/* Color Picker */}
                <Box sx={{ marginBottom: 1 }}>
                  <TextField
                    label="Select Color"
                    type="color"
                    value={previewConfig.color}
                    onChange={(e) => handlePreviewConfigChange('color', e.target.value)}
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    variant="outlined"
                  />
                </Box>

                {/* Wireframe Toggle */}
                <Box sx={{ marginBottom: 0 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={previewConfig.wireframe}
                        onChange={(e) => handlePreviewConfigChange('wireframe', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Wireframe Mode"
                  />
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        </Drawer>

        {/* Modal Alert */}
        <Dialog
          open={openAlert}
          onClose={handleCloseAlert}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">{"Export Error"}</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              The mesh could not be found. Please ensure the 3D model is loaded correctly before exporting.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseAlert} autoFocus>
              OK
            </Button>
          </DialogActions>
        </Dialog>

        {/* Canvas displaying the shape */}
        <div className="canvas-container">
          <ModelPreview
            modelRef={modelRef}
            modelConfig={modelConfig}
            previewConfig={previewConfig}
          />
        </div>
      </div>
    </ThemeProvider>
  );
}

// Create a dark theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

export default App;