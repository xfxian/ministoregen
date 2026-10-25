import { createTheme } from '@mui/material/styles';

/** Drafting-table look: dark graphite, a faint drawing grid, mono numbers, orange actions. */
export const tokens = {
  bg: '#11161c',
  panel: '#171d24',
  raised: '#1d242d',
  line: 'rgba(220, 230, 240, 0.14)',
  lineStrong: 'rgba(220, 230, 240, 0.32)',
  text: '#e3eaf2',
  muted: '#9aa8b8',
  accent: '#ff8a3d',
  accentSoft: 'rgba(255, 138, 61, 0.12)',
  accentText: '#ffb385',
  drawing: '#dce6f0',
  ok: '#9be3aa',
  okSoft: 'rgba(123, 216, 143, 0.12)',
  warn: '#ffd88a',
  warnSoft: 'rgba(255, 200, 97, 0.12)',
  error: '#ff9e94',
  errorSoft: 'rgba(255, 138, 128, 0.12)',
  sans: '"Space Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
};

/** Background for drawing surfaces: a 24 px grid like drafting paper. */
export const gridPaper = {
  backgroundColor: tokens.bg,
  backgroundImage: `linear-gradient(rgba(220,230,240,0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(220,230,240,0.045) 1px, transparent 1px)`,
  backgroundSize: '24px 24px',
};

/** Small uppercase mono label used for section headings and title blocks. */
export const overline = {
  fontFamily: tokens.mono,
  fontSize: 12,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: tokens.muted,
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: tokens.accent, contrastText: '#1a1206' },
    secondary: { main: '#6fd3ff' },
    success: { main: '#7bd88f' },
    warning: { main: '#ffc861' },
    error: { main: '#ff8a80' },
    background: { default: tokens.bg, paper: tokens.panel },
    divider: tokens.line,
    text: { primary: tokens.text, secondary: tokens.muted },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: tokens.sans,
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiDialog: { styleOverrides: { paper: { border: `1px solid ${tokens.line}` } } },
    MuiToggleButton: { styleOverrides: { root: { textTransform: 'none' } } },
    MuiOutlinedInput: { styleOverrides: { notchedOutline: { borderColor: tokens.lineStrong } } },
    MuiTooltip: { styleOverrides: { tooltip: { fontSize: 13 } } },
    MuiButton: { styleOverrides: { root: { minHeight: 36 } } },
  },
});
