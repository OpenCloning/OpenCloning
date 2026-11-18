import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, FormControl } from '@mui/material';
import { openCloningDBHttpClient, endpoints, SequenceSelect } from '@opencloning/opencloningdb';
import SampleSelect from './SampleSelect';
import useSampleMutation from '../hooks/useSampleMutation';

/**
 * Move a sample (and its sequencing files) to another sequence, e.g. a sample planned as one sequence that turned
 * out to be another one when sequenced.
 * With sample, the sample is fixed and the user picks the target sequence; without it, the user picks a sample
 * of another sequence to move it to sequenceId.
 */
function TransferSampleDialog({ sequenceId, open, onClose, sample = null }) {
  const [selectedSample, setSelectedSample] = React.useState(null);
  const [targetSequence, setTargetSequence] = React.useState(null);

  const movedSample = sample ?? selectedSample;
  const target = sample ? targetSequence : { id: sequenceId };

  const handleClose = () => {
    setSelectedSample(null);
    setTargetSequence(null);
    onClose();
  };

  const transferMutation = useSampleMutation({
    mutationFn: async () => {
      const body = { sequence_id: target.id };
      const { data } = await openCloningDBHttpClient.post(endpoints.sequenceSampleReassign(movedSample.uid), body);
      return data;
    },
    successMessage: 'UID transferred successfully',
    onSuccess: handleClose,
  });

  const excludeOwnSamples = React.useCallback((s) => s.sequence_id !== sequenceId, [sequenceId]);

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={handleClose} data-testid="transfer-sample-dialog">
      <DialogTitle>
        {sample ? `Move sample ${sample.uid} to another sequence` : 'Transfer UID from another sequence to this sequence'}
      </DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1 }}>
          {sample
            ? <SequenceSelect multiple={false} label="Sequence" value={targetSequence} onChange={setTargetSequence} />
            : <SampleSelect value={selectedSample} onChange={setSelectedSample} filter={excludeOwnSamples} />}
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
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => transferMutation.mutate()}
          disabled={!movedSample || !target || transferMutation.isPending}
        >
          {transferMutation.isPending ? 'Transferring…' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TransferSampleDialog;
