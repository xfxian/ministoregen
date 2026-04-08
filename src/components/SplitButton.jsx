import { useState, useCallback } from 'react';
import {
  Button,
  ButtonGroup,
  ClickAwayListener,
  Grow,
  IconButton,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Tooltip,
} from '@mui/material';
import { ArrowDropDown, Download } from '@mui/icons-material';

function SplitButton({ onDownloadAll, onDownloadBin, onDownloadInlay, binEnabled, compact }) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const anchorRef = useCallback((node) => setAnchorEl(node), []);

  const handleToggle = () => setOpen((prev) => !prev);
  const handleClose = (event) => {
    if (anchorEl && anchorEl.contains(event.target)) return;
    setOpen(false);
  };

  const popper = (
    <Popper open={open} anchorEl={anchorEl} transition disablePortal placement="bottom-end" style={{ zIndex: 1300 }}>
      {({ TransitionProps }) => (
        <Grow {...TransitionProps}>
          <Paper>
            <ClickAwayListener onClickAway={handleClose}>
              <MenuList autoFocusItem>
                <MenuItem onClick={() => { onDownloadAll(); setOpen(false); }} disabled={!binEnabled}>
                  Download All
                </MenuItem>
                <MenuItem onClick={() => { onDownloadInlay(); setOpen(false); }}>
                  Download Inlay Only
                </MenuItem>
                <MenuItem onClick={() => { onDownloadBin(); setOpen(false); }} disabled={!binEnabled}>
                  Download Bin Only
                </MenuItem>
              </MenuList>
            </ClickAwayListener>
          </Paper>
        </Grow>
      )}
    </Popper>
  );

  if (compact) {
    return (
      <>
        <Tooltip title="Export STL">
          <IconButton color="inherit" onClick={handleToggle} ref={anchorRef} size="small">
            <Download />
          </IconButton>
        </Tooltip>
        {popper}
      </>
    );
  }

  return (
    <>
      <ButtonGroup variant="outlined" color="inherit" ref={anchorRef}>
        <Button startIcon={<Download />} onClick={onDownloadAll} disabled={!binEnabled}>
          Download All
        </Button>
        <Button size="small" onClick={handleToggle} aria-haspopup="menu">
          <ArrowDropDown />
        </Button>
      </ButtonGroup>
      {popper}
    </>
  );
}

export default SplitButton;
