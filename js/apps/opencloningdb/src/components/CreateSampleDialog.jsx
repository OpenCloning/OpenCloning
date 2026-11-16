import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogTitle, DialogContent, Button, FormControl, Alert, Box, IconButton, TextField } from '@mui/material';
import { AddCircle as AddCircleIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import NewSampleUID from './NewSampleUID';
import useAppAlerts from '../hooks/useAppAlerts';
import error2String from '@opencloning/utils/error2String';

function CreateSampleDialog({ sequenceId, open, onClose }) {
  const { addAlert } = useAppAlerts();
  const queryClient = useQueryClient();
  const nextIdRef = React.useRef(1);
  const [rows, setRows] = React.useState([{ id: 0, validatedUid: '', isChecking: false, location: '' }]);

  const handleValidatedChange = React.useCallback((rowId, value) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, validatedUid: value } : r)));
  }, []);

  const handleValidationStateChange = React.useCallback((rowId, { isChecking }) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, isChecking } : r)));
  }, []);

  const handleLocationChange = (rowId, location) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, location } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { id: nextIdRef.current++, validatedUid: '', isChecking: false, location: '' }]);
  };

  const removeRow = (rowId) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const allValid = rows.every((r) => r.validatedUid.length > 0);
  const validUids = rows.map((r) => r.validatedUid);
  const duplicateUids = [...new Set(validUids.filter((uid, i) => uid && validUids.indexOf(uid) !== i))];
  const hasDuplicates = duplicateUids.length > 0;

  const createMutation = useMutation({
    mutationFn: async (rowsToCreate) => {
      const results = await Promise.all(
        rowsToCreate.map(({ validatedUid: uid, location }) => {
          const body = { uid, sequence_id: sequenceId, location: location.trim() || null };
          return openCloningDBHttpClient.post(endpoints.postSequenceSample, body);
        }),
      );
      return results;
    },
    onSuccess: (results) => {
      addAlert({ message: `${results.length} sample UID(s) created successfully`, severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId] });
      queryClient.invalidateQueries({ queryKey: ['sequence_samples'] });
      resetAndClose();
    },
    onError: (error) => {
      addAlert({
        message: error2String(error),
        severity: 'error',
      });
    },
  });

  const anyChecking = rows.some((r) => r.isChecking);
  const canSubmit = allValid && !hasDuplicates && !anyChecking && !createMutation.isPending;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate(rows);
  };

  const resetAndClose = () => {
    setRows([{ id: 0, validatedUid: '', isChecking: false, location: '' }]);
    nextIdRef.current = 1;
    onClose();
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={resetAndClose} data-testid="create-sequence-sample-uid-dialog">
      <DialogTitle>Create sample UIDs</DialogTitle>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          {rows.map((row, index) => (
            <Box key={row.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <FormControl fullWidth>
                <NewSampleUID
                  onChange={(value) => handleValidatedChange(row.id, value)}
                  onValidationStateChange={(state) => handleValidationStateChange(row.id, state)}
                  label={`Sample UID ${index + 1}`}
                />
              </FormControl>
              <TextField
                label="Location (optional)"
                value={row.location}
                onChange={(e) => handleLocationChange(row.id, e.target.value)}
                sx={{ mb: 3, minWidth: 180 }}
                slotProps={{ htmlInput: { 'data-testid': 'create-sample-location' } }}
              />
              {rows.length > 1 && (
                <IconButton onClick={() => removeRow(row.id)} size="small" sx={{ mb: 3 }}>
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
            <Button onClick={addRow} color="success" startIcon={<AddCircleIcon />}>
              Add another UID
            </Button>
          </Box>
          {hasDuplicates && (
            <Alert severity="error" sx={{ mt: 1 }}>
              Duplicate UIDs: {duplicateUids.join(', ')}
            </Alert>
          )}
          {createMutation.isError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {error2String(createMutation.error)}
            </Alert>
          )}
          <FormControl fullWidth sx={{ mt: 2 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={!canSubmit}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </FormControl>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateSampleDialog;
