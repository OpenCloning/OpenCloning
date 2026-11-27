import { useMutation, useQueryClient } from '@tanstack/react-query';
import useAppAlerts from './useAppAlerts';

/**
 * Mutation that changes samples or their sequencing files. On success it shows successMessage (a string, or a
 * function of the mutation result). Success or not (a mutation can make several requests, and fail after some of
 * them changed samples), it refreshes everything that shows samples: sequence pages (a sample can move between
 * sequences), the sequences and samples lists, and the UID checks.
 */
export default function useSampleMutation({ mutationFn, successMessage, onSuccess }) {
  const queryClient = useQueryClient();
  const { addAlert, addErrorAlert } = useAppAlerts();
  return useMutation({
    mutationFn,
    onSettled: () => {
      ['sequence', 'sequences', 'sequence_samples', 'sequence_sample'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    },
    onSuccess: (data, variables) => {
      addAlert({ message: typeof successMessage === 'function' ? successMessage(data, variables) : successMessage, severity: 'success' });
      onSuccess?.(data, variables);
    },
    onError: addErrorAlert,
  });
}
