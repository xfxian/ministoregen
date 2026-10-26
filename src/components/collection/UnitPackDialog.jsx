import { DeleteOutline, FileUpload, Refresh } from '@mui/icons-material';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Link, List,
  ListItemButton, ListItemText, ListSubheader, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { useMemo, useRef, useState } from 'react';
import { GENERIC_PACK } from '../../model/genericPack';
import { packUnitSummary, searchPack } from '../../model/unitPacks';
import {
  deleteUnitPack, fetchUnitPack, listUnitPacks, readUnitPackText, saveUnitPack,
} from '../../state/unitPacks';
import { overline, tokens } from '../../theme';

const BUILT_IN = 'built-in';
const SHOWN = 150;

function PackInfo({ pack, external }) {
  const credit = [pack.author && `by ${pack.author}`, pack.licence && `licence: ${pack.licence}`].filter(Boolean).join(' · ');
  return (
    <Stack spacing={1}>
      {pack.description && <Typography variant="body2" sx={{ color: tokens.muted }}>{pack.description}</Typography>}
      {(credit || pack.source) && (
        <Typography variant="body2" sx={{ color: tokens.muted }}>
          {credit}
          {credit && pack.source && ' · '}
          {pack.source && <Link href={pack.source} target="_blank" rel="noopener noreferrer">source</Link>}
        </Typography>
      )}
      {external && (
        <Alert severity="info" variant="outlined" data-testid="pack-disclaimer">
          A community library, not part of ministoregen. It is unofficial and not affiliated with or endorsed by
          Games Workshop or any other publisher; names belong to their owners. Check bases against your models.
        </Alert>
      )}
    </Stack>
  );
}

/** Groups matching units under their category, keeping pack order. */
function byCategory(units) {
  const groups = new Map();
  for (const u of units) {
    const key = u.category || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(u);
  }
  return [...groups];
}

/**
 * Picks a unit from a library: the generic one that ships with the app, or a
 * community library loaded by URL or from a file. The picked unit opens in the unit
 * dialog, so counts and heights can be adjusted before adding it.
 */
function UnitPackDialog({ onPick, onClose }) {
  const [packs, setPacks] = useState(() => listUnitPacks());
  const [packId, setPackId] = useState(() => packs.at(-1)?.id ?? BUILT_IN);
  const [query, setQuery] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInput = useRef(null);

  const entry = packs.find((p) => p.id === packId);
  const pack = entry?.pack ?? GENERIC_PACK;
  const matches = useMemo(() => searchPack(pack, query), [pack, query]);

  const adopt = (parsed, from) => {
    const saved = saveUnitPack(parsed, from);
    setPacks(listUnitPacks());
    setPackId(saved.id);
    setQuery('');
    const skipped = parsed.skipped ? ` ${parsed.skipped} could not be read and were left out.` : '';
    const n = parsed.units.length;
    setMessage({ severity: 'success', text: `Loaded ${parsed.name}: ${n} unit${n === 1 ? '' : 's'}.${skipped}` });
  };

  const load = async (address) => {
    setBusy(true);
    setMessage(null);
    try {
      adopt(await fetchUnitPack(address), address.trim());
      setUrl('');
    } catch (e) {
      setMessage({ severity: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const loadFile = async (file) => {
    setMessage(null);
    try {
      adopt(readUnitPackText(await file.text()), '');
    } catch (e) {
      setMessage({ severity: 'error', text: e.message });
    }
  };

  const remove = () => {
    deleteUnitPack(packId);
    setPacks(listUnitPacks());
    setPackId(BUILT_IN);
    setMessage(null);
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="pack-dialog-title">
      <DialogTitle id="pack-dialog-title">Add from a unit library</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select
              size="small"
              label="Library"
              value={packId}
              onChange={(e) => { setPackId(e.target.value); setQuery(''); setMessage(null); }}
              sx={{ flex: 1, minWidth: 0 }}
            >
              <MenuItem value={BUILT_IN}>{GENERIC_PACK.name}</MenuItem>
              {packs.map((p) => <MenuItem key={p.id} value={p.id}>{p.pack.name}</MenuItem>)}
            </TextField>
            {entry?.url && (
              <Tooltip title="Load again from its address">
                <span>
                  <IconButton onClick={() => load(entry.url)} disabled={busy} aria-label={`Update ${pack.name}`}><Refresh /></IconButton>
                </span>
              </Tooltip>
            )}
            {entry && (
              <Tooltip title="Remove this library">
                <IconButton onClick={remove} aria-label={`Remove ${pack.name}`}><DeleteOutline /></IconButton>
              </Tooltip>
            )}
          </Stack>

          <PackInfo pack={pack} external={Boolean(entry)} />
          {message && <Alert severity={message.severity} onClose={() => setMessage(null)}>{message.text}</Alert>}

          <TextField
            size="small"
            label="Search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${pack.units.length} units`}
          />
          <List
            dense
            aria-label="Units in this library"
            sx={{ maxHeight: { xs: 300, sm: 360 }, overflowY: 'auto', border: `1px solid ${tokens.line}`, borderRadius: 1, py: 0 }}
          >
            {byCategory(matches.slice(0, SHOWN)).map(([category, units]) => (
              <li key={category}>
                <ul style={{ padding: 0 }}>
                  <ListSubheader sx={{ ...overline, bgcolor: tokens.panel, lineHeight: '32px' }}>{category}</ListSubheader>
                  {units.map((u, i) => (
                    <ListItemButton key={`${u.name}-${i}`} onClick={() => onPick(u)}>
                      <ListItemText primary={u.name} secondary={packUnitSummary(u)} />
                    </ListItemButton>
                  ))}
                </ul>
              </li>
            ))}
            {!matches.length && <Typography variant="body2" sx={{ p: 2, color: tokens.muted }}>No unit matches.</Typography>}
          </List>
          {matches.length > SHOWN && (
            <Typography variant="body2" sx={{ color: tokens.muted }}>
              Showing {SHOWN} of {matches.length}. Search to narrow it down.
            </Typography>
          )}

          <Box component="form" onSubmit={(e) => { e.preventDefault(); if (url.trim()) load(url); }}>
            <Typography sx={{ ...overline, mb: 1 }}>Load a community library</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                label="Library address (https)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                sx={{ flex: 1 }}
                inputProps={{ inputMode: 'url' }}
              />
              <Stack direction="row" spacing={1}>
                <Button type="submit" variant="outlined" disabled={busy || !url.trim()} startIcon={busy ? <CircularProgress size={16} /> : null}>Load</Button>
                <Button startIcon={<FileUpload />} onClick={() => fileInput.current?.click()}>From file</Button>
              </Stack>
            </Stack>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              data-testid="pack-file"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default UnitPackDialog;
