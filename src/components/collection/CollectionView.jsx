import { Add, ContentCopy, LibraryBooks } from '@mui/icons-material';
import { Box, Button, ButtonBase, Typography, useMediaQuery } from '@mui/material';
import { useRef, useState } from 'react';
import {
  addCase, addUnit, assignRemaining, assignedCount, distribute, makeCase, makeUnit, patchUnit, removeUnit,
  setSortMode, unassigned, unitTotal,
} from '../../model/collection';
import { isDefaultProject } from '../../model/project';
import { unitFromPack } from '../../model/unitPacks';
import { gridPaper, overline, tokens } from '../../theme';
import CaseCard, { useUnitDrop } from './CaseCard';
import CaseDetail from './CaseDetail';
import Shelf from './Shelf';
import UnitCard from './UnitCard';
import UnitDialog from './UnitDialog';
import UnitPackDialog from './UnitPackDialog';

function NewCaseCard({ onCreate, onDropUnit }) {
  const { over, handlers } = useUnitDrop(onDropUnit);
  return (
    <ButtonBase
      onClick={onCreate}
      {...handlers}
      sx={{
        minHeight: 200, display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 1.5, p: 2,
        border: `1px dashed ${over ? tokens.accent : tokens.lineStrong}`, bgcolor: over ? tokens.accentSoft : 'transparent',
        color: tokens.text, '&:hover': { borderColor: tokens.accent },
        '&.Mui-focusVisible': { outline: `2px solid ${tokens.accent}`, outlineOffset: 2 },
      }}
    >
      <Typography sx={{ fontSize: 17, fontWeight: 700 }}>+ New case</Typography>
      <Typography variant="body2" sx={{ color: tokens.muted, maxWidth: 240, textAlign: 'center' }}>
        Starts empty and sizes itself to what you put in
      </Typography>
    </ButtonBase>
  );
}

function EmptyCollection({ onAdd, onAddFromLibrary, onImportSingle, singleGroups, onSwitchToSingle }) {
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', my: { xs: 4, md: 10 }, px: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={overline}>Collection</Typography>
      <Typography component="h1" sx={{ fontSize: { xs: 32, md: 44 }, fontWeight: 700, lineHeight: 1.05 }}>
        List what you own. The cases follow.
      </Typography>
      <Typography sx={{ color: tokens.muted, fontSize: 17, lineHeight: 1.5 }}>
        Add each unit once: its models with base, height and how many. Then sort them into Gridfinity cases automatically,
        or by hand. Everything stays in this browser.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
        <Button variant="contained" size="large" startIcon={<Add />} onClick={onAdd}>Add your first unit</Button>
        <Button variant="outlined" size="large" startIcon={<LibraryBooks />} onClick={onAddFromLibrary}>Pick from a library</Button>
        {singleGroups > 0 && (
          <Button variant="outlined" size="large" startIcon={<ContentCopy />} onClick={onImportSingle}>
            Copy {singleGroups} group{singleGroups === 1 ? '' : 's'} from my single bin
          </Button>
        )}
      </Box>
      <Typography variant="body2" sx={{ color: tokens.muted, mt: 2 }}>
        Only need one bin?{' '}
        <Box component="button" type="button" onClick={onSwitchToSingle} sx={{ font: 'inherit', color: tokens.accentText, background: 'none', border: 0, p: 0, cursor: 'pointer', textDecoration: 'underline' }}>
          Switch to Single bin
        </Box>
        , no collection needed.
      </Typography>
    </Box>
  );
}

/** Collection mode: units, the shelf of unplaced minis, the cases board and the selected case. */
function CollectionView({
  collection, update, cases, selectedId, onSelect, onExportCase, onShareCase, onDeleteCase, exportingId,
  singleProject, onSwitchToSingle, onToast,
}) {
  const [dialog, setDialog] = useState(null); // { unit, isNew }
  const [packsOpen, setPacksOpen] = useState(false);
  const detailRef = useRef(null);
  const stacked = useMediaQuery('(max-width: 899.95px)');
  const selected = cases.find((c) => c.caseItem.id === selectedId) ?? cases[0];
  const statuses = Object.fromEntries(cases.map((c) => [c.caseItem.id, c.status]));
  const total = collection.units.reduce((n, u) => n + unitTotal(u), 0);
  const modelCount = collection.units.reduce((n, u) => n + u.models.length, 0);
  const waiting = unassigned(collection).reduce((n, w) => n + w.count, 0);

  // Discrete actions get their own undo step.
  const commit = (recipe) => update(recipe, { commit: true });

  const select = (id) => {
    onSelect(id);
    if (stacked) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const assign = (unitId, caseId) => {
    if (caseId) {
      commit(assignRemaining(caseId, unitId));
      onSelect(caseId);
      return;
    }
    const fresh = makeCase(collection);
    commit((c) => assignRemaining(fresh.id, unitId)(addCase(fresh)(c)));
    onSelect(fresh.id);
  };

  const newCase = () => {
    const fresh = makeCase(collection);
    commit(addCase(fresh));
    select(fresh.id);
  };

  const sort = () => {
    const before = collection.cases.length;
    const next = distribute(collection);
    commit(next);
    const left = unassigned(next).reduce((n, w) => n + w.count, 0);
    const added = next.cases.length - before;
    onToast(left
      ? `Sorted. ${left} could not be placed: their bases are too big for the largest case.`
      : `Sorted everything${added > 0 ? ` and opened ${added} new case${added === 1 ? '' : 's'}` : ''}.`);
    if (!selectedId && next.cases.length) onSelect(next.cases[0].id);
  };

  const importSingle = () => {
    commit((c) => singleProject.groups.reduce(
      (acc, g) => addUnit(makeUnit(acc.units.length, { ...g, id: undefined }))(acc), c,
    ));
  };

  const packDialog = packsOpen && (
    <UnitPackDialog
      onPick={(entry) => { setPacksOpen(false); setDialog({ unit: unitFromPack(entry, modelCount), isNew: true }); }}
      onClose={() => setPacksOpen(false)}
    />
  );

  if (!collection.units.length && !collection.cases.length) {
    return (
      <Box sx={{ height: '100%', overflowY: 'auto', ...gridPaper }}>
        <EmptyCollection
          onAdd={() => setDialog({ unit: makeUnit(0), isNew: true })}
          onAddFromLibrary={() => setPacksOpen(true)}
          onImportSingle={importSingle}
          singleGroups={isDefaultProject(singleProject) ? 0 : singleProject.groups.length}
          onSwitchToSingle={onSwitchToSingle}
        />
        {dialog && (
          <UnitDialog
            unit={dialog.unit}
            isNew
            storedCount={() => 0}
            onSave={(unit) => { commit(addUnit(unit)); setDialog(null); }}
            onClose={() => setDialog(null)}
          />
        )}
        {packDialog}
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, overflowY: { xs: 'auto', md: 'hidden' }, ...gridPaper }}>
      <Box component="main" sx={{ flex: { md: '1 1 auto' }, minWidth: 0, overflowY: { md: 'auto' }, p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 2 }}>
          <Box sx={{ flex: '1 1 300px' }}>
            <Typography sx={overline}>Collection</Typography>
            <Typography component="h1" data-testid="collection-summary" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 700, lineHeight: 1.1, mt: 0.5 }}>
              {waiting
                ? `${total} minis, ${waiting} still need${waiting === 1 ? 's' : ''} a home`
                : `${total} minis in ${collection.cases.length} case${collection.cases.length === 1 ? '' : 's'}`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<LibraryBooks />} onClick={() => setPacksOpen(true)}>From library</Button>
            <Button variant="outlined" startIcon={<Add />} onClick={() => setDialog({ unit: makeUnit(modelCount), isNew: true })}>Add unit</Button>
          </Box>
        </Box>

        <Box component="section" aria-label="Units" sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))', gap: 1.5 }}>
          {collection.units.map((u) => (
            <UnitCard key={u.id} collection={collection} unit={u} onOpen={() => setDialog({ unit: u, isNew: false })} />
          ))}
        </Box>

        <Shelf
          collection={collection}
          statuses={statuses}
          onAssign={assign}
          onSort={sort}
          onSortMode={(mode) => commit(setSortMode(mode))}
        />

        <Box component="section" aria-labelledby="cases-title" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography id="cases-title" component="h2" sx={overline}>Cases · {collection.cases.length}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 1.5 }}>
            {cases.map((c) => (
              <CaseCard
                key={c.caseItem.id}
                caseItem={c.caseItem}
                project={c.project}
                plan={c.plan}
                status={c.status}
                selected={selected?.caseItem.id === c.caseItem.id}
                onSelect={() => select(c.caseItem.id)}
                onDropUnit={(unitId) => assign(unitId, c.caseItem.id)}
              />
            ))}
            <NewCaseCard onCreate={newCase} onDropUnit={(unitId) => assign(unitId, null)} />
          </Box>
        </Box>
      </Box>

      <Box
        ref={detailRef}
        component="aside"
        aria-label="Selected case"
        sx={{
          flex: { md: '0 0 clamp(400px, 38vw, 560px)' }, overflowY: { md: 'auto' }, bgcolor: tokens.panel,
          borderLeft: { md: `1px solid ${tokens.line}` }, borderTop: { xs: `1px solid ${tokens.line}`, md: 0 },
        }}
      >
        {selected ? (
          <CaseDetail
            key={selected.caseItem.id}
            collection={collection}
            caseItem={selected.caseItem}
            project={selected.project}
            plan={selected.plan}
            status={selected.status}
            onUpdate={update}
            onExport={() => onExportCase(selected)}
            onShare={() => onShareCase(selected)}
            onDelete={() => onDeleteCase(selected.caseItem)}
            exporting={exportingId === selected.caseItem.id}
          />
        ) : (
          <Box sx={{ p: 3, color: tokens.muted }}>
            <Typography sx={overline}>No case yet</Typography>
            <Typography sx={{ mt: 1 }}>Sort your units into cases, or start a new case and add units to it.</Typography>
          </Box>
        )}
      </Box>

      {dialog && (
        <UnitDialog
          unit={dialog.unit}
          isNew={dialog.isNew}
          storedCount={(modelId) => assignedCount(collection, dialog.unit.id, modelId)}
          colorIndex={modelCount}
          onSave={(unit) => {
            commit(dialog.isNew ? addUnit(unit) : patchUnit(unit.id, unit));
            setDialog(null);
          }}
          onDelete={(id) => { commit(removeUnit(id)); setDialog(null); onToast('Unit deleted.', true); }}
          onClose={() => setDialog(null)}
        />
      )}
      {packDialog}
    </Box>
  );
}

export default CollectionView;
