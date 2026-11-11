import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import useAppAlerts from './useAppAlerts';


function useDeleteSequenceUIDMutation() {
  const queryClient = useQueryClient();
  const { addAlert } = useAppAlerts();
  const deleteSequenceUIDMutation = useMutation({
    mutationFn: async (uid) => {
      const { data: resp } = await openCloningDBHttpClient.delete(endpoints.sequenceSample(uid));
      return resp.data;
    },
    onSuccess: (data) => {
      const sequenceId = data.sequence_id;
      const uid = data.uid;
      queryClient.invalidateQueries({ queryKey: ['sequence_samples', {uid}] });
      queryClient.invalidateQueries({ queryKey: ['sequence_sample', uid] });
      queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId, 'cloning_strategy'] });
      addAlert({ message: `UID ${uid} deleted successfully`, severity: 'success' });
    },
    onError: (error) => {
      addAlert({ message: error?.response?.data?.detail || error?.message || 'Error deleting sequence UID', severity: 'error' });
    },
  });
  return deleteSequenceUIDMutation;
}

export default useDeleteSequenceUIDMutation;
