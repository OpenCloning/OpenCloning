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
  TextField,
} from '@mui/material';
import { formatSequenceName, SequenceSelect } from '@opencloning/opencloningdb';
import NewLineUID from './NewLineUID';
import LineSelect from './LineSelect';
import { getPlasmidSequencesInLine, getAlleleSequencesInLine } from '../utils/models_utils';
import useCreateLineMutation from '../hooks/useCreateLineMutation';

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

  const [lineUID, setLineUID] = React.useState('');
  const [lineUidChecking, setLineUidChecking] = React.useState(false);
  const [selectedParents, setSelectedParents] = React.useState([]);
  const [alleles, setAlleles] = React.useState([]);
  const [plasmids, setPlasmids] = React.useState([]);

  React.useEffect(() => {
    if (!open) return;
    setLineUID('');
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
    if (!lineUID || !canSubmit) return;
    const resp = await createLineMutation.mutateAsync({
      uid: lineUID,
      allele_ids: alleles.map((a) => a.id),
      plasmid_ids: plasmids.map((p) => p.id),
      parent_ids: selectedParents.map((p) => p.id),
    });
    navigate(`/lines/${resp.id}`);
  };

  return (
    <Dialog open={open} onClose={onClose} data-testid="create-line-dialog">
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <NewLineUID
              onChange={setLineUID}
              onValidationStateChange={({ isChecking }) => setLineUidChecking(isChecking)}
            />
          </FormControl>
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
              {createLineMutation.error?.response?.data?.detail || createLineMutation.error?.message || 'Failed to create line'}
            </Alert>
          )}
          <FormControl fullWidth sx={{ mt: 2 }}>
            <Button
              disabled={!lineUID || !canSubmit || lineUidChecking || createLineMutation.isPending}
              type="submit"
              variant="contained"
              color="primary"
            >
              {createLineMutation.isPending ? 'Creating…' : 'Submit'}
            </Button>
          </FormControl>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateLineDialog;
