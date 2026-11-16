import React from 'react';
import { isEqual } from 'lodash-es';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  TextField,
} from '@mui/material';
import { AddCircle as AddCircleIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { formatSequenceName, SequenceSelect } from '@opencloning/opencloningdb';
import NewLineUID from './NewLineUID';
import LineSelect from './LineSelect';
import { getPlasmidSequencesInLine, getAlleleSequencesInLine } from '../utils/models_utils';
import useCreateLineMutation from '../hooks/useCreateLineMutation';
import error2String from '@opencloning/utils/error2String';
import useAppAlerts from '../hooks/useAppAlerts';

const MAX_PARENTS = 2;

function getUniqueIds(sequences) {
  return new Set(sequences.map((s) => s.id));
}

function mergeSequences(existing, incoming) {
  const seenIds = new Set();
  return [...existing, ...incoming].filter((s) => {
    if (seenIds.has(s.id)) return false;
    seenIds.add(s.id);
    return true;
  });
}

function getSequencesFromParents(parents) {
  return {
    alleles: mergeSequences([], parents.flatMap(getAlleleSequencesInLine)),
    plasmids: mergeSequences([], parents.flatMap(getPlasmidSequencesInLine)),
  };
}

function ParentSequenceSelect({ parents, value, onChange, label, sequenceType }) {
  const getter = sequenceType === 'allele' ? getAlleleSequencesInLine : getPlasmidSequencesInLine;
  const options = React.useMemo(
    () => mergeSequences([], parents.flatMap(getter)),
    [parents, getter],
  );

  return (
    <Autocomplete
      multiple
      options={options}
      getOptionLabel={formatSequenceName}
      getOptionKey={(seq) => seq.id}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      filterOptions={(opts, state) => {
        const input = state.inputValue.trim().toLowerCase();
        if (!input) return opts;
        return opts.filter((seq) => formatSequenceName(seq).toLowerCase().includes(input));
      }}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}

function InfoAlert({ parents }) {
  let alertContent = null;
  if (parents.length === 0) {
    alertContent = (
      <Box><b>No parent selected:</b> you are creating:
        <ul>
          <li>a reference line</li>
          <li>a line that you received from someone and you don&apos;t know its parents</li>
        </ul>
      </Box>
    );
  } else if (parents.length === 1) {
    alertContent = (
      <>
        <Box>
          <b>1 parent selected:</b> you are transforming alleles or plasmids into that parent to create a new line.
        </Box>
        <Box>
          You can also remove existing plasmids or alleles, for instance to represent the further modification
          of an allele that was already there.
        </Box>
      </>
    );
  } else if (parents.length === 2) {
    alertContent = (
      <Box><b>2 parents selected:</b> you are crossing two lines, so you can only select alleles present in the parents.</Box>
    );
  }
  return (
    <Alert severity="info" sx={{ mt: 1 }} data-testid="create-line-info-alert">{alertContent}</Alert>
  );

}

function CreateLineDialog({ open, onClose, fixedParents = null }) {
  const navigate = useNavigate();
  const createLineMutation = useCreateLineMutation();
  const { addAlert } = useAppAlerts();

  // Several UIDs create sibling lines (e.g. isolates of the same transformation), with the same parents and sequences
  const nextRowIdRef = React.useRef(1);
  const [uidRows, setUidRows] = React.useState([{ id: 0, uid: '', checking: false }]);
  const updateUidRow = (rowId, changes) => setUidRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...changes } : r)));
  const lineUIDs = uidRows.map((r) => r.uid);
  const duplicatedUIDs = [...new Set(lineUIDs.filter((uid, i) => uid && lineUIDs.findIndex((u) => u.toLowerCase() === uid.toLowerCase()) !== i))];
  const uidsReady = lineUIDs.every((uid) => uid) && duplicatedUIDs.length === 0 && !uidRows.some((r) => r.checking);
  const [selectedParents, setSelectedParents] = React.useState([]);
  const [alleles, setAlleles] = React.useState([]);
  const [plasmids, setPlasmids] = React.useState([]);

  React.useEffect(() => {
    if (!open) return;
    nextRowIdRef.current = 1;
    setUidRows([{ id: 0, uid: '', checking: false }]);
    const initialParents = fixedParents ?? [];
    setSelectedParents(initialParents);
    const { alleles: initialAlleles, plasmids: initialPlasmids } = getSequencesFromParents(initialParents);
    setAlleles(initialAlleles);
    setPlasmids(initialPlasmids);
  }, [open, fixedParents]);

  const handleParentsChange = (newParents) => {
    if (newParents.length > MAX_PARENTS) return;
    setSelectedParents(newParents);
    const { alleles: nextAlleles, plasmids: nextPlasmids } = getSequencesFromParents(newParents);
    setAlleles(nextAlleles);
    setPlasmids(nextPlasmids);
  };

  const parentDerivedSequences = getSequencesFromParents(selectedParents);
  const sequencesChangedFromParents = !isEqual(getUniqueIds(alleles), getUniqueIds(parentDerivedSequences.alleles))
    || !isEqual(getUniqueIds(plasmids), getUniqueIds(parentDerivedSequences.plasmids));

  const restrictToParentSequences = selectedParents.length === 2;
  const canSubmit = selectedParents.length === 1
    ? sequencesChangedFromParents
    : true;

  const dialogTitle = fixedParents
    ? `Select sequences transformed into ${fixedParents[0]?.uid}`
    : 'Create line';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!uidsReady || !canSubmit) return;
    const created = [];
    for (const uid of lineUIDs) {
      created.push(await createLineMutation.mutateAsync({
        uid,
        allele_ids: alleles.map((a) => a.id),
        plasmid_ids: plasmids.map((p) => p.id),
        parent_ids: selectedParents.map((p) => p.id),
      }));
    }
    onClose();
    if (created.length === 1) {
      navigate(`/lines/${created[0].id}`);
    } else {
      addAlert({ message: `${created.length} lines created: ${lineUIDs.join(', ')}`, severity: 'success' });
      navigate('/lines');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} data-testid="create-line-dialog">
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          {uidRows.map((row, index) => (
            <Box key={row.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <FormControl fullWidth>
                <NewLineUID
                  label={index === 0 ? 'Line UID' : `Line UID ${index + 1}`}
                  onChange={(uid) => updateUidRow(row.id, { uid })}
                  onValidationStateChange={({ isChecking }) => updateUidRow(row.id, { checking: isChecking })}
                />
              </FormControl>
              {uidRows.length > 1 && (
                <IconButton onClick={() => setUidRows((prev) => prev.filter((r) => r.id !== row.id))} size="small" sx={{ mb: 3 }} aria-label="Remove line UID">
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              onClick={() => setUidRows((prev) => [...prev, { id: nextRowIdRef.current++, uid: '', checking: false }])}
              color="success"
              size="small"
              startIcon={<AddCircleIcon />}
            >
              Add a sibling line (another isolate)
            </Button>
          </Box>
          {duplicatedUIDs.length > 0 && (
            <Alert severity="error" sx={{ mt: 1 }}>Duplicate UIDs: {duplicatedUIDs.join(', ')}</Alert>
          )}
          <FormControl fullWidth sx={{ mt: 1 }}>
            <LineSelect
              multiple
              value={selectedParents}
              label="Parent lines"
              onChange={handleParentsChange}
              disabled={fixedParents != null}
            />
          </FormControl>
          <InfoAlert parents={selectedParents} />
          <FormControl fullWidth sx={{ mt: 1 }}>
            {restrictToParentSequences ? (
              <ParentSequenceSelect
                parents={selectedParents}
                value={alleles}
                label="Alleles"
                onChange={setAlleles}
                sequenceType="allele"
              />
            ) : (
              <SequenceSelect multiple value={alleles} label="Alleles" onChange={setAlleles} sequenceTypes={['allele']} />
            )}
          </FormControl>
          <FormControl fullWidth sx={{ mt: 1 }}>
            {restrictToParentSequences ? (
              <ParentSequenceSelect
                parents={selectedParents}
                value={plasmids}
                label="Plasmids"
                onChange={setPlasmids}
                sequenceType="plasmid"
              />
            ) : (
              <SequenceSelect multiple value={plasmids} label="Plasmids" onChange={setPlasmids} sequenceTypes={['plasmid']} />
            )}
          </FormControl>
          {createLineMutation.isError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {error2String(createLineMutation.error)}
            </Alert>
          )}
          <FormControl fullWidth sx={{ mt: 2 }}>
            <Button
              disabled={!uidsReady || !canSubmit || createLineMutation.isPending}
              type="submit"
              variant="contained"
              color="primary"
            >
              {createLineMutation.isPending ? 'Creating…' : (uidRows.length > 1 ? `Create ${uidRows.length} lines` : 'Submit')}
            </Button>
          </FormControl>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateLineDialog;
