import { useMutation, useQueryClient } from '@tanstack/react-query';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import useAppAlerts from './useAppAlerts';

export default function useCreateLineMutation() {
  const { addAlert } = useAppAlerts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body) => {
      const { data } = await openCloningDBHttpClient.post(endpoints.postLine, body);
      return data;
    },
    onSuccess: (line) => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      queryClient.invalidateQueries({ queryKey: ['line', line.id] });
      for (const parentId of line.parent_ids) {
        queryClient.invalidateQueries({ queryKey: ['line', parentId] });
      }
    },
    onError: (error) => {
      addAlert({ message: error?.response?.data?.detail || error?.message || 'Failed to create line', severity: 'error' });
    },
  });
}
