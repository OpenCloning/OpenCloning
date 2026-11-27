import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, FormControl } from '@mui/material';
import { openCloningDBHttpClient, endpoints, SequenceSelect } from '@opencloning/opencloningdb';
import SampleSelect from './SampleSelect';
import useSampleMutation from '../hooks/useSampleMutation';

// Inside the dialog, so that its state is reset when the dialog closes
function TransferSampleForm({ sequenceId, isTemplateSequence, onClose, sample }) {
  const [selectedSample, setSelectedSample] = React.useState(null);
  const [targetSequence, setTargetSequence] = React.useState(null);

  const movedSample = sample ?? selectedSample;
  const target = sample ? targetSequence : { id: sequenceId };

  const transferMutation = useSampleMutation({
    mutationFn: async () => {
      const body = { sequence_id: target.id };
      const { data } = await openCloningDBHttpClient.post(endpoints.sequenceSampleReassign(movedSample.uid), body);
      return data;
    },
    successMessage: 'UID transferred successfully',
    onSuccess: onClose,
  });

  // The backend does not allow samples with sequencing files to point to a template sequence
  const sampleFilter = React.useCallback(
    (s) => s.sequence_id !== sequenceId && !(isTemplateSequence && s.sequencing_files.length > 0),
    [sequenceId, isTemplateSequence],
  );
  const hasFiles = sample?.sequencing_files.length > 0;
  const sequenceFilter = React.useMemo(() => (hasFiles ? (s) => s.type === 'sequence' : undefined), [hasFiles]);

  return (
    <>
      <DialogTitle>
        {sample ? `Move sample ${sample.uid} to another sequence` : 'Transfer UID from another sequence to this sequence'}
      </DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1 }}>
          {sample
            ? <SequenceSelect multiple={false} label="Sequence" value={targetSequence} onChange={setTargetSequence} filter={sequenceFilter} />
            : <SampleSelect value={selectedSample} onChange={setSelectedSample} filter={sampleFilter} />}
        </FormControl>
        {movedSample && target && (
          <Typography sx={{ mt: 2 }}>
            Are you sure you want to transfer UID <strong>{movedSample.uid}</strong>
            {!sample && <> from sequence <strong>{movedSample.sequence?.name ?? movedSample.sequence_id}</strong></>}
            {sample ? <> to sequence <strong>{target.name}</strong>?</> : ' to this one?'}
            {' '}Its sequencing files are moved with it.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => transferMutation.mutate()}
          disabled={!movedSample || !target || transferMutation.isPending}
        >
          {transferMutation.isPending ? 'Transferring…' : 'Confirm'}
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * Move a sample (and its sequencing files) to another sequence, e.g. a sample planned as one sequence that turned
 * out to be another one when sequenced.
 * With sample, the sample is fixed and the user picks the target sequence; without it, the user picks a sample
 * of another sequence to move it to sequenceId.
 * Samples with sequencing files cannot point to a template sequence, so that combination is not offered.
 */
function TransferSampleDialog({ sequenceId, isTemplateSequence = false, open, onClose, sample = null }) {
  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose} data-testid="transfer-sample-dialog">
      <TransferSampleForm sequenceId={sequenceId} isTemplateSequence={isTemplateSequence} onClose={onClose} sample={sample} />
    </Dialog>
  );
}

export default TransferSampleDialog;
