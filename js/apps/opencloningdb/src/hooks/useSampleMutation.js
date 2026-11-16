import { useMutation, useQueryClient } from '@tanstack/react-query';
import useAppAlerts from './useAppAlerts';

/**
 * Mutation that changes samples or their sequencing files. On success it shows successMessage (a string, or a
 * function of the mutation result) and refreshes everything that shows samples: sequence pages (a sample can move
 * between sequences), the sequences and samples lists, and the UID checks.
 */
export default function useSampleMutation({ mutationFn, successMessage, onSuccess }) {
  const queryClient = useQueryClient();
  const { addAlert, addErrorAlert } = useAppAlerts();
  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      ['sequence', 'sequences', 'sequence_samples', 'sequence_sample'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      addAlert({ message: typeof successMessage === 'function' ? successMessage(data, variables) : successMessage, severity: 'success' });
      onSuccess?.(data, variables);
    },
    onError: addErrorAlert,
  });
}
