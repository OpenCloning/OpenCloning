import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';

import useAppAlerts from '../hooks/useAppAlerts';

function ChangeSequenceCircularityButton({
  sequenceId,
  hasParents,
  hasChildren,
  hasOverhangs,
  isCircular,
}) {
  const { addAlert } = useAppAlerts();
  const queryClient = useQueryClient();
  const [localIsCircular, setLocalIsCircular] = React.useState(isCircular);

  React.useEffect(() => {
    setLocalIsCircular(isCircular);
  }, [isCircular]);

  const mutation = useMutation({
    mutationFn: () => openCloningDBHttpClient.patch(endpoints.sequenceChangeCircularity(sequenceId)),
    onSuccess: () => {
      setLocalIsCircular(prev => !prev);
      addAlert({ message: 'Sequence circularity updated', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId, 'cloning_strategy'] });
      queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId, 'sequencing_files'] });
      queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId, 'primers'] });
    },
    onError: (error) => {
      addAlert({
        message: error?.response?.data?.detail || error?.message || 'Could not change circularity',
        severity: 'error',
      });
    },
  });

  if (hasParents || hasChildren || hasOverhangs) {
    return null;
  }

  return (
    <Button
      variant="outlined"
      size="small"
      data-testid="change-sequence-circularity-button"
      disabled={mutation.isPending}
      startIcon={mutation.isPending ? <CircularProgress size={16} /> : null}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending || (localIsCircular !== isCircular) ? 'Updating…' : isCircular ? 'Make linear' : 'Make circular'}
    </Button>
  );
}

export default ChangeSequenceCircularityButton;
