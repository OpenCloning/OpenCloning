import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, FormControl } from '@mui/material';
import { QuerySelect, useDebouncedSearchQuery } from '@opencloning/ui';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import useAppAlerts from '../hooks/useAppAlerts';

const getSearchQuery = (sequenceId) => (uid) => ({
  queryKey: ['sequence_samples', { uid }],
  queryFn: async () => {
    const { data } = await openCloningDBHttpClient.get(endpoints.sequenceSamples, { params: { uid } });
    return data.filter((sample) => sample.sequence_id !== sequenceId);
  },
});

function TransferSampleDialog({ sequenceId, open, onClose }) {
  const { addAlert } = useAppAlerts();
  const queryClient = useQueryClient();
  const [selectedSample, setSelectedSample] = React.useState(null);
  const [confirming, setConfirming] = React.useState(false);

  const getQuery = React.useMemo(() => getSearchQuery(sequenceId), [sequenceId]);
  const { query, autocompleteProps, clearInput } = useDebouncedSearchQuery(getQuery);

  const transferMutation = useMutation({
    mutationFn: async (uid) => {
      const body = { sequence_id: sequenceId };
      const { data } = await openCloningDBHttpClient.patch(endpoints.sequenceSample(uid), body);
      return data;
    },
    onSuccess: () => {
      addAlert({ message: 'UID transferred successfully', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId, 'cloning_strategy'] });
      handleClose();
    },
    onError: (error) => {
      addAlert({
        message: error?.response?.data?.detail || error?.message || 'Error transferring UID',
        severity: 'error',
      });
    },
  });

  const handleSelect = (value) => {
    setSelectedSample(value);
    if (value) {
      setConfirming(true);
    } else {
      setConfirming(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedSample) return;
    transferMutation.mutate(selectedSample.uid);
  };

  const handleClose = () => {
    setSelectedSample(null);
    setConfirming(false);
    clearInput();
    onClose();
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={handleClose}>
      <DialogTitle>Transfer UID from another sequence to this sequence</DialogTitle>
      <DialogContent>
        {!confirming ? (
          <FormControl fullWidth sx={{ mt: 1 }}>
            <QuerySelect
              query={query}
              label="Search UIDs"
              multiple={false}
              getOptionLabel={(sample) => `${sample.uid} (${sample.sequence?.name ?? sample.sequence_id})`}
              getOptionKey={(sample) => sample.uid}
              value={selectedSample}
              onChange={handleSelect}
              autoComplete
              autocompleteProps={autocompleteProps}
              onClear={clearInput}
            />
          </FormControl>
        ) : (
          <Typography sx={{ mt: 1 }}>
            Are you sure you want to transfer UID <strong>{selectedSample.uid}</strong> from
            sequence <strong>{selectedSample.sequence?.name ?? selectedSample.sequence_id}</strong> to
            this one?
          </Typography>
        )}
      </DialogContent>
      {confirming && (
        <DialogActions>
          <Button onClick={() => { setConfirming(false); setSelectedSample(null); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={transferMutation.isPending}
          >
            {transferMutation.isPending ? 'Transferring…' : 'Confirm'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

export default TransferSampleDialog;
