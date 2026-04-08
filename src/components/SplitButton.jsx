import { useState, useCallback } from 'react';
import {
  Button,
  ButtonGroup,
  ClickAwayListener,
  Grow,
  MenuItem,
  MenuList,
  Paper,
  Popper,
} from '@mui/material';
import { ArrowDropDown, Download } from '@mui/icons-material';

function SplitButton({ onDownloadAll, onDownloadBin, onDownloadInlay, binEnabled }) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const anchorRef = useCallback((node) => setAnchorEl(node), []);

  const handleToggle = () => setOpen((prev) => !prev);
  const handleClose = (event) => {
    if (anchorEl && anchorEl.contains(event.target)) return;
    setOpen(false);
  };

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
      <Popper open={open} anchorEl={anchorEl} transition disablePortal placement="bottom-end" style={{ zIndex: 1300 }}>
        {({ TransitionProps }) => (
          <Grow {...TransitionProps}>
            <Paper>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList autoFocusItem>
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
    </>
  );
}

export default SplitButton;
