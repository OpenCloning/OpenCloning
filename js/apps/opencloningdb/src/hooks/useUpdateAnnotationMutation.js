import { useMutation, useQueryClient } from '@tanstack/react-query';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import useAppAlerts from './useAppAlerts';
import error2String from '@opencloning/utils/error2String';

export default function useUpdateAnnotationMutation(sequenceId, textFileSequence) {
  const { addAlert } = useAppAlerts();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newFileContent) => {
      const newTextFileSequence = { ...textFileSequence, file_content: newFileContent };
      return openCloningDBHttpClient.patch(endpoints.sequenceChangeAnnotation(sequenceId), newTextFileSequence);
    },
    onSuccess: () => {
      addAlert({ message: 'Annotation updated', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId, 'text_file_sequence'] });
      queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId, 'cloning_strategy'] });
    },
    onError: (error) => {
      addAlert({ message: error2String(error), severity: 'error' });
    },
  });
}
