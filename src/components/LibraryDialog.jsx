import { ContentCopy, Delete, FileDownload, FileUpload } from '@mui/icons-material';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItem, ListItemButton,
  ListItemText, Stack, Tooltip, Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import { downloadBlob } from '../export';
import { deleteDesign, exportLibrary, importLibrary, listDesigns, saveDesign } from '../state/library';

function summary(project) {
  const minis = project.groups.reduce((n, g) => n + g.count, 0);
  return `${project.groups.length} group${project.groups.length === 1 ? '' : 's'}, ${minis} miniatures`;
}

function LibraryDialog({ open, onClose, currentId, onOpenDesign, onNewDesign }) {
  const [designs, setDesigns] = useState(() => listDesigns());
  const [message, setMessage] = useState(null);
  const fileInput = useRef(null);
  const refresh = () => setDesigns(listDesigns());

  const handleImport = async (file) => {
    try {
      const count = importLibrary(await file.text());
      setMessage({ severity: 'success', text: `Imported ${count} design${count === 1 ? '' : 's'}.` });
      refresh();
    } catch (e) {
      setMessage({ severity: 'error', text: e.message });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" TransitionProps={{ onEnter: refresh }}>
      <DialogTitle>Library</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Designs are saved in this browser. Export the library to back it up or move it to another device.
        </Typography>
        {message && <Alert severity={message.severity} sx={{ mb: 1 }} onClose={() => setMessage(null)}>{message.text}</Alert>}
        {designs.length === 0 ? (
          <Typography variant="body2" sx={{ py: 3, textAlign: 'center' }}>No saved designs yet.</Typography>
        ) : (
          <List dense>
            {designs.map((d) => (
              <ListItem
                key={d.id}
                disablePadding
                secondaryAction={(
                  <Stack direction="row">
                    <Tooltip title="Duplicate">
                      <IconButton edge="end" onClick={() => { saveDesign({ ...d.project, name: `${d.project.name} (copy)` }); refresh(); }}><ContentCopy fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton edge="end" aria-label={`Delete ${d.project.name}`} onClick={() => { deleteDesign(d.id); refresh(); }}><Delete fontSize="small" /></IconButton>
                    </Tooltip>
                  </Stack>
                )}
              >
                <ListItemButton selected={d.id === currentId} onClick={() => onOpenDesign(d)}>
                  <ListItemText
                    primary={d.project.name}
                    secondary={`${summary(d.project)} · saved ${new Date(d.savedAt).toLocaleString()}`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<FileDownload />} disabled={!designs.length}
            onClick={() => downloadBlob(new Blob([exportLibrary()], { type: 'application/json' }), 'ministoregen-library.json')}>
            Export
          </Button>
          <Button startIcon={<FileUpload />} onClick={() => fileInput.current?.click()}>Import</Button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button onClick={onNewDesign}>New design</Button>
          <Button onClick={onClose} variant="contained">Close</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

export default LibraryDialog;
