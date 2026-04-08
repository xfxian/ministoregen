import { Close, CropPortrait, ExpandMore, Inventory2Outlined, Preview, Settings } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  FormHelperText,
  Grid2 as Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { GRIDFINITY_HEIGHT_UNIT, SELECT_ITEMS } from '../config';
import NumberInput from './NumberInput';
import SectionViz from './SectionViz';

// Primary fields shown by default; everything else goes into Advanced
const INLAY_PRIMARY = ['length', 'width'];
const SECTION_PRIMARY = ['sizeX', 'sizeY'];

const LABELS = {
  inlay: {
    length: { label: 'Length', help: 'Length of the inner side of your container' },
    width: { label: 'Width', help: 'Width of the inner side of your container' },
    cornerRadius: { label: 'Corner Radius', help: "Radius of the inlay's rounded corners" },
    depth: { label: 'Depth', help: 'Extrusion depth of the inlay, giving it height' },
    margin: { label: 'Margin', help: "Minimum space between holes and the inlay's edge" },
    clearance: { label: 'Clearance', help: 'To allow the inlay to snugly fit into your container' },
  },
  section: {
    share: { label: 'Share', help: 'Percentage of the inlay taken up by this section', unit: '%' },
    sizeX: { label: 'Base Width', help: 'Width of your miniature bases' },
    sizeY: { label: 'Base Length', help: 'Length of your miniature bases' },
    curvatureFactor: { label: 'Curvature', help: 'Modify the curvature of the ellipse hole', unit: '' },
    spacing: { label: 'Spacing', help: 'Minimum space between each base hole' },
    clearance: { label: 'Clearance', help: 'To allow miniature bases to easily fit into the holes' },
  },
};

function TabPanel({ children, value, index }) {
  return value === index ? (
    <Box sx={{ pt: 2, pb: 1, overflowY: 'auto', flex: 1 }}>
      {children}
    </Box>
  ) : null;
}

function FieldGrid({ entries, onChange, isSelectItem, isMode, modeKey, step, labelMap }) {
  return (
    <Grid container spacing={1.5}>
      {entries.map(([key, value]) => (
        <Grid size={6} key={key}>
          <NumberInput
            label={labelMap[key]?.label || key}
            helperText={labelMap[key]?.help}
            value={value}
            onChange={(e) => onChange(key, parseFloat(e.target.value) || 0)}
            fullWidth
            margin="none"
            step={key === 'curvatureFactor' ? 0.01 : (step || 0.1)}
            unit={
              isMode && isSelectItem(modeKey, key)
                ? SELECT_ITEMS[modeKey][key].unit
                : labelMap[key]?.unit !== undefined
                ? labelMap[key].unit
                : 'mm'
            }
            select={isMode && isSelectItem(modeKey, key)}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end" sx={{ marginRight: 3 }}>
                    {SELECT_ITEMS[modeKey]?.[key]?.unit}
                  </InputAdornment>
                ),
              },
            }}
          >
            {isMode &&
              isSelectItem(modeKey, key) &&
              SELECT_ITEMS[modeKey][key].options.map(([v, desc]) => (
                <MenuItem key={`${key}-${v}`} value={v}>{desc}</MenuItem>
              ))}
          </NumberInput>
        </Grid>
      ))}
    </Grid>
  );
}

function AdvancedAccordion({ children }) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{ '&:before': { display: 'none' }, bgcolor: 'transparent', mt: 0.5 }}
    >
      <AccordionSummary
        expandIcon={<ExpandMore fontSize="small" />}
        sx={{ px: 0, minHeight: 32, '& .MuiAccordionSummary-content': { my: 0 } }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
          Advanced
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0, pt: 0 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

function Sidebar({
  modelConfig,
  binConfig,
  binHeightUnit,
  previewConfig,
  inlayMode,
  baseMode,
  selectedSection,
  isMobile,
  onClose,
  onInlayConfigChange,
  onBaseSectionConfigChange,
  onBaseSectionAdd,
  onBaseSectionRemove,
  onBinConfigChange,
  onBinHeightUnitChange,
  onPreviewConfigChange,
  onInlayModeChange,
  onBaseModeChange,
  onSelectSection,
}) {
  const [activeTab, setActiveTab] = useState(0);

  const isGridfinityMode = inlayMode === 'gridfinity';
  const is40kMode = baseMode === '40k';
  const sections = modelConfig.base.sections;
  const hasMultipleSections = sections.length > 1;

  const activeSectionIndex =
    selectedSection !== null && selectedSection < sections.length
      ? selectedSection
      : sections.length > 0 ? 0 : null;
  const activeSection = activeSectionIndex !== null ? sections[activeSectionIndex] : null;

  const isSelectItem = (mode, key) => SELECT_ITEMS[mode] && SELECT_ITEMS[mode][key] !== undefined;

  // Split inlay fields into primary and advanced
  const inlayEntries = Object.entries(modelConfig.inlay);
  const inlayPrimary = inlayEntries.filter(([k]) => INLAY_PRIMARY.includes(k));
  const inlayAdvanced = inlayEntries.filter(([k]) => !INLAY_PRIMARY.includes(k));

  // Split section fields: share only shown for multi-section; curvature/spacing/clearance are advanced
  const sectionAdvancedKeys = ['curvatureFactor', 'spacing', 'clearance'];
  const sectionPrimaryKeys = hasMultipleSections
    ? ['share', ...SECTION_PRIMARY]
    : SECTION_PRIMARY;

  const sectionEntries = activeSection ? Object.entries(activeSection) : [];
  const sectionPrimary = sectionEntries.filter(([k]) => sectionPrimaryKeys.includes(k));
  const sectionAdvanced = sectionEntries.filter(([k]) => sectionAdvancedKeys.includes(k));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Mobile header row with title + close button */}
      {isMobile && (
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1 }}>
            Settings
          </Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close settings">
            <Close />
          </IconButton>
        </Box>
      )}

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
      >
        <Tab icon={<Settings fontSize="small" />} iconPosition="start" label="General" sx={{ minHeight: 48, fontSize: '0.75rem' }} />
        <Tab icon={<CropPortrait fontSize="small" />} iconPosition="start" label="Inlay" sx={{ minHeight: 48, fontSize: '0.75rem' }} />
        <Tab icon={<Inventory2Outlined fontSize="small" />} iconPosition="start" label="Bin" sx={{ minHeight: 48, fontSize: '0.75rem' }} />
      </Tabs>

      {/* ── TAB 0: GENERAL ── */}
      <TabPanel value={activeTab} index={0}>
        <Box sx={{ px: 2 }}>
          <Typography variant="overline" color="text.secondary">Inlay Type</Typography>
          <ToggleButtonGroup
            exclusive
            value={inlayMode}
            fullWidth
            onChange={(_, v) => v && onInlayModeChange(v)}
            sx={{ mb: 2 }}
          >
            <ToggleButton value="gridfinity">Gridfinity</ToggleButton>
            <ToggleButton value="custom">Custom</ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="overline" color="text.secondary">Bin</Typography>
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={binConfig.enabled}
                  onChange={(e) => onBinConfigChange('enabled', e.target.checked)}
                  color="primary"
                />
              }
              label={binConfig.enabled ? 'Bin enabled' : 'Bin disabled'}
              labelPlacement="start"
              sx={{ width: '100%', justifyContent: 'space-between', ml: 0 }}
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="overline" color="text.secondary">
            <Preview fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
            Preview
          </Typography>

          <Box sx={{ mt: 1, mb: 1 }}>
            <TextField
              label="Color"
              type="color"
              value={previewConfig.color}
              onChange={(e) => onPreviewConfigChange('color', e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              variant="outlined"
              size="small"
            />
          </Box>

          <Box sx={{ mb: 1 }}>
            <TextField
              select
              label="Corner Segments"
              value={binConfig.cornerSegments}
              onChange={(e) => onBinConfigChange('cornerSegments', parseInt(e.target.value))}
              fullWidth
              variant="outlined"
              size="small"
              helperText="Higher = smoother corners, slower render"
            >
              {[8, 16, 32, 64].map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </TextField>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={previewConfig.wireframe}
                onChange={(e) => onPreviewConfigChange('wireframe', e.target.checked)}
                color="primary"
                size="small"
              />
            }
            label="Wireframe"
            labelPlacement="start"
            sx={{ width: '100%', justifyContent: 'space-between', ml: 0 }}
          />
        </Box>
      </TabPanel>

      {/* ── TAB 1: INLAY ── */}
      <TabPanel value={activeTab} index={1}>
        <Box sx={{ px: 2 }}>
          <Typography variant="overline" color="text.secondary">Container Shape</Typography>

          {/* Primary inlay fields */}
          <Box sx={{ mt: 0.5, mb: 1 }}>
            <FieldGrid
              entries={inlayPrimary}
              onChange={onInlayConfigChange}
              isMode={isGridfinityMode}
              isSelectItem={isSelectItem}
              modeKey="gridfinity"
              labelMap={LABELS.inlay}
            />
          </Box>

          {/* Advanced inlay fields */}
          <AdvancedAccordion>
            <FieldGrid
              entries={inlayAdvanced}
              onChange={onInlayConfigChange}
              isMode={isGridfinityMode}
              isSelectItem={isSelectItem}
              modeKey="gridfinity"
              labelMap={LABELS.inlay}
            />
          </AdvancedAccordion>

          <Divider sx={{ my: 2 }} />

          {/* Section Overview */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>
                Base Sections
              </Typography>
              <Chip label={sections.length} size="small" color="primary" variant="outlined" />
            </Stack>
          </Stack>

          <SectionViz
            sections={sections}
            selectedSection={activeSectionIndex}
            onSelectSection={onSelectSection}
          />

          {/* Selected section editor */}
          {activeSection !== null && (
            <Box sx={{ mt: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  Section {activeSectionIndex + 1}
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      onBaseSectionAdd(activeSectionIndex);
                      onSelectSection(activeSectionIndex + 1);
                    }}
                    variant="outlined"
                  >
                    Add
                  </Button>
                  <Button
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={() => onBaseSectionRemove(activeSectionIndex)}
                    color="error"
                    variant="outlined"
                    disabled={sections.length <= 1}
                  >
                    Remove
                  </Button>
                </Stack>
              </Stack>

              <ToggleButtonGroup
                exclusive
                value={baseMode}
                fullWidth
                onChange={(_, v) => v && onBaseModeChange(v)}
                size="small"
                sx={{ mb: 1.5 }}
              >
                <ToggleButton value="40k">40k</ToggleButton>
                <ToggleButton value="custom">Custom</ToggleButton>
              </ToggleButtonGroup>

              {/* Primary section fields */}
              <FieldGrid
                entries={sectionPrimary}
                onChange={(key, val) => onBaseSectionConfigChange(activeSectionIndex, key, val)}
                isMode={is40kMode}
                isSelectItem={isSelectItem}
                modeKey="40k"
                labelMap={LABELS.section}
              />

              {/* Advanced section fields */}
              <AdvancedAccordion>
                <FieldGrid
                  entries={sectionAdvanced}
                  onChange={(key, val) => onBaseSectionConfigChange(activeSectionIndex, key, val)}
                  isMode={is40kMode}
                  isSelectItem={isSelectItem}
                  modeKey="40k"
                  labelMap={LABELS.section}
                />
              </AdvancedAccordion>
            </Box>
          )}
        </Box>
      </TabPanel>

      {/* ── TAB 2: BIN ── */}
      <TabPanel value={activeTab} index={2}>
        <Box sx={{ px: 2 }}>
          {!binConfig.enabled && (
            <FormHelperText sx={{ mb: 2, color: 'text.secondary' }}>
              Enable the bin in the General tab to edit these settings.
            </FormHelperText>
          )}
          <Box
            sx={{
              opacity: binConfig.enabled ? 1 : 0.4,
              pointerEvents: binConfig.enabled ? 'auto' : 'none',
            }}
          >
            <Grid container spacing={1.5}>
              <Grid size={6}>
                <NumberInput
                  label="Wall Thickness"
                  helperText="Thickness of bin walls"
                  value={binConfig.wallThickness}
                  onChange={(e) => onBinConfigChange('wallThickness', parseFloat(e.target.value) || 0)}
                  fullWidth
                  margin="none"
                  step={0.1}
                  unit="mm"
                  min={0.1}
                />
              </Grid>
              <Grid size={6}>
                <NumberInput
                  label="Floor Thickness"
                  helperText="Thickness of bin floor"
                  value={binConfig.floorThickness}
                  onChange={(e) => onBinConfigChange('floorThickness', parseFloat(e.target.value) || 0)}
                  fullWidth
                  margin="none"
                  step={0.1}
                  unit="mm"
                  min={0.1}
                />
              </Grid>
              <Grid size={12}>
                <ToggleButtonGroup
                  exclusive
                  value={binHeightUnit}
                  fullWidth
                  size="small"
                  onChange={(_, v) => v && onBinHeightUnitChange(v)}
                  sx={{ mb: 1 }}
                >
                  <ToggleButton value="mm">mm</ToggleButton>
                  <ToggleButton value="u">Gridfinity units</ToggleButton>
                </ToggleButtonGroup>
                <NumberInput
                  label="Bin Height"
                  helperText={
                    binHeightUnit === 'u'
                      ? `1 unit = ${GRIDFINITY_HEIGHT_UNIT}mm`
                      : 'Total bin height including floor'
                  }
                  value={
                    binHeightUnit === 'u'
                      ? Math.round(binConfig.heightMm / GRIDFINITY_HEIGHT_UNIT)
                      : binConfig.heightMm
                  }
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    onBinConfigChange(
                      'heightMm',
                      binHeightUnit === 'u' ? v * GRIDFINITY_HEIGHT_UNIT : v
                    );
                  }}
                  fullWidth
                  margin="none"
                  step={binHeightUnit === 'u' ? 1 : 0.5}
                  unit={binHeightUnit}
                  min={1}
                />
              </Grid>
              <Grid size={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={binConfig.stackingLip}
                      onChange={(e) => onBinConfigChange('stackingLip', e.target.checked)}
                      color="primary"
                      size="small"
                    />
                  }
                  label="Stacking Lip"
                  labelPlacement="start"
                  sx={{ width: '100%', justifyContent: 'space-between', ml: 0 }}
                />
              </Grid>
              <Grid size={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={binConfig.baseFeet}
                      onChange={(e) => onBinConfigChange('baseFeet', e.target.checked)}
                      disabled={!isGridfinityMode}
                      color="primary"
                      size="small"
                    />
                  }
                  label="Gridfinity Base Feet"
                  labelPlacement="start"
                  sx={{ width: '100%', justifyContent: 'space-between', ml: 0 }}
                />
                {!isGridfinityMode && (
                  <FormHelperText>Only available in Gridfinity mode</FormHelperText>
                )}
              </Grid>
            </Grid>
          </Box>
        </Box>
      </TabPanel>
    </Box>
  );
}

export default Sidebar;
