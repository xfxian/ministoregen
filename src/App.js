import './App.css';
import { useState, useRef } from 'react';
import {
  TextField,
  Typography,
  Box,
  CssBaseline,
  AppBar,
  Toolbar,
  Drawer,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControlLabel,
  Switch
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { STLExporter } from 'three-stdlib';
import ModelPreview from 'ModelPreview';

function App() {
  const drawerWidth = 250;

  const [modelConfig, setModelConfig] = useState({
    inlay: {
      length: 121.9,
      width: 79.9,
      cornerRadius: 1.6,
      depth: 3,
      margin: 1,
      clearance: 0.25
    },
    base: {
      size: 25,
      spacing: 1,
      clearance: 0.5
    }
  })
  //const { inlay, base } = modelConfig;

  const handleModelConfigChange = (section, field, value) => {
    setModelConfig((prevConfig) => ({
      ...prevConfig,
      [section]: {
        ...prevConfig[section],
        [field]: value,
      },
    }));
  };

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
            <Button variant='outlined' color="inherit" onClick={handleExport}>
              Download STL
            </Button>
          </Toolbar>
        </AppBar>

        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
          }}
        >
          <Toolbar />
          <Box
            sx={{ width: drawerWidth, padding: 2, backgroundColor: 'background.default' }}
          >
            <Typography variant="h6" gutterBottom>
              Inlay Properties
            </Typography>

            {Object.entries(modelConfig.inlay).map(([key, value]) =>
            (
              <Box sx={{ marginBottom: 0 }} key={`box-inlay-${key}`}>
                <TextField
                  label={key}
                  type="number"
                  value={value}
                  onChange={(e) => handleModelConfigChange('inlay', key, parseFloat(e.target.value) || 0)}
                  fullWidth
                  margin="normal"
                />
              </Box>
            )
            )}

            <Typography variant="h6" gutterBottom>
              Base Properties
            </Typography>

            {Object.entries(modelConfig.base).map(([key, value]) =>
            (
              <Box sx={{ marginBottom: 0 }} key={`box-base-${key}`}>
                <TextField
                  label={key}
                  type="number"
                  value={value}
                  onChange={(e) => handleModelConfigChange('base', key, parseFloat(e.target.value) || 0)}
                  fullWidth
                  margin="normal"
                />
              </Box>
            )
            )}

            <Typography variant="h6" gutterBottom>
              Representation
            </Typography>

            {/* Color Picker */}
            <Box sx={{ marginTop: 3, marginBottom: 1 }}>
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