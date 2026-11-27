import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, TextField } from '@mui/material';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import NewSampleUID from './NewSampleUID';
import useSampleMutation from '../hooks/useSampleMutation';

// Inside the dialog, so that its state starts from the sample each time the dialog opens
function EditSampleForm({ sample, onClose }) {
  const [uid, setUid] = React.useState(sample.uid);
  const [uidChecking, setUidChecking] = React.useState(false);
  const [location, setLocation] = React.useState(sample.location ?? '');

  const editMutation = useSampleMutation({
    mutationFn: async () => {
      const body = { uid, location: location.trim() };
      const { data } = await openCloningDBHttpClient.patch(endpoints.sequenceSample(sample.uid), body);
      return data;
    },
    successMessage: 'Sample updated successfully',
    onSuccess: onClose,
  });

  const unchanged = uid === sample.uid && location.trim() === (sample.location ?? '');
  const canSubmit = uid.length > 0 && !uidChecking && !unchanged && !editMutation.isPending;

  return (
    <>
      <DialogTitle>Edit sample {sample.uid}</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <NewSampleUID
            label="Sample UID"
            defaultValue={sample.uid}
            excludeUid={sample.uid}
            onChange={setUid}
            onValidationStateChange={({ isChecking }) => setUidChecking(isChecking)}
          />
        </FormControl>
        <TextField
          fullWidth
          label="Location"
          placeholder="e.g. -80 box 3, A4"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'edit-sample-location' } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!canSubmit} onClick={() => editMutation.mutate()}>
          {editMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Rename a sample and / or change its location. */
function EditSampleDialog({ sample, open, onClose }) {
  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose} data-testid="edit-sample-dialog">
      <EditSampleForm sample={sample} onClose={onClose} />
    </Dialog>
  );
}

export default EditSampleDialog;
