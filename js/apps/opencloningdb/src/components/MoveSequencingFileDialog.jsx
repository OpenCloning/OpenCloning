import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl } from '@mui/material';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import SampleSelect from './SampleSelect';
import useSampleMutation from '../hooks/useSampleMutation';

/** Move a sequencing file ({ id, name, sampleUid }) to another sample, e.g. when it was linked to the wrong one. */
function MoveSequencingFileDialog({ file, open, onClose }) {
  const [target, setTarget] = React.useState(null);
  const handleClose = () => {
    setTarget(null);
    onClose();
  };
  const moveMutation = useSampleMutation({
    mutationFn: async () => {
      const { data } = await openCloningDBHttpClient.patch(endpoints.sequencingFile(file.id), { sample_uid: target.uid });
      return data;
    },
    successMessage: (data) => `Sequencing file moved to sample ${data.sample_uid}`,
    onSuccess: handleClose,
  });
  const otherSamples = React.useCallback((sample) => sample.uid !== file.sampleUid, [file.sampleUid]);

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={handleClose} data-testid="move-sequencing-file-dialog">
      <DialogTitle>Move {file.name} to another sample</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <SampleSelect value={target} onChange={setTarget} label="Sample" filter={otherSamples} />
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" disabled={!target || moveMutation.isPending} onClick={() => moveMutation.mutate()}>
          {moveMutation.isPending ? 'Moving…' : 'Move'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default MoveSequencingFileDialog;
