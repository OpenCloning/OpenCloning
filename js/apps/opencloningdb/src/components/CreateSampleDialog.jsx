import React from 'react';
import { Dialog, DialogTitle, DialogContent, TextField } from '@mui/material';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import NewSampleUID from './NewSampleUID';
import UidRowsForm from './UidRowsForm';
import useUidRows from '../hooks/useUidRows';
import useSampleMutation from '../hooks/useSampleMutation';

// Inside the dialog, so that its state is reset when the dialog closes
function CreateSampleForm({ sequenceId, onClose }) {
  const uidRows = useUidRows({ location: '' });

  const createMutation = useSampleMutation({
    mutationFn: async (rows) => {
      const created = [];
      // Sequential, so that if one fails the ones before it are created
      for (const { uid, location } of rows) {
        const body = { uid, sequence_id: sequenceId, location: location.trim() || null };
        const { data } = await openCloningDBHttpClient.post(endpoints.postSequenceSample, body);
        created.push(data);
      }
      return created;
    },
    successMessage: (created) => `${created.length} sample UID(s) created successfully`,
    onSuccess: onClose,
  });

  return (
    <>
      <DialogTitle>Create sample UIDs</DialogTitle>
      <DialogContent>
        <UidRowsForm
          uidRows={uidRows}
          UidField={NewSampleUID}
          uidLabel="Sample UID"
          renderExtraFields={(row) => (
            <TextField
              label="Location (optional)"
              value={row.location}
              onChange={(e) => uidRows.updateRow(row.id, { location: e.target.value })}
              sx={{ mb: 3, minWidth: 180 }}
              slotProps={{ htmlInput: { 'data-testid': 'create-sample-location' } }}
            />
          )}
          onSubmit={() => createMutation.mutate(uidRows.rows)}
          submitting={createMutation.isPending}
          submitText="Create"
        />
      </DialogContent>
    </>
  );
}

function CreateSampleDialog({ sequenceId, open, onClose }) {
  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose} data-testid="create-sequence-sample-uid-dialog">
      <CreateSampleForm sequenceId={sequenceId} onClose={onClose} />
    </Dialog>
  );
}

export default CreateSampleDialog;
