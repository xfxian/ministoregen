import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { unitTotal } from '../model/collection';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Asks what to do with a collection opened from a share link: replace the viewer's own,
 * add it to theirs, or leave everything as it is.
 */
function SharedCollectionDialog({ collection, hasOwn, onChoose }) {
  const minis = collection ? collection.units.reduce((n, u) => n + unitTotal(u), 0) : 0;
  return (
    <Dialog open={Boolean(collection)} onClose={() => onChoose('cancel')} fullWidth maxWidth="xs">
      <DialogTitle>Open a shared collection</DialogTitle>
      {collection && (
        <DialogContent>
          <Typography gutterBottom>
            <strong>{collection.name}</strong>: {plural(collection.units.length, 'unit')}, {plural(minis, 'mini')} in{' '}
            {plural(collection.cases.length, 'case')}.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {hasOwn
              ? 'You already have a collection in this browser. Replace it with this one, or add these units and cases to yours.'
              : 'It is saved in this browser, like a collection you made yourself.'}
          </Typography>
        </DialogContent>
      )}
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={() => onChoose('cancel')}>{hasOwn ? 'Keep mine' : 'Cancel'}</Button>
        {hasOwn && <Button onClick={() => onChoose('add')}>Add to mine</Button>}
        <Button variant="contained" onClick={() => onChoose('replace')}>{hasOwn ? 'Replace mine' : 'Open'}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default SharedCollectionDialog;
