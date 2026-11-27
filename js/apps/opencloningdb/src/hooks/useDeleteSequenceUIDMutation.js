import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import useSampleMutation from './useSampleMutation';

function useDeleteSequenceUIDMutation() {
  return useSampleMutation({
    mutationFn: async (uid) => {
      const { data: resp } = await openCloningDBHttpClient.delete(endpoints.sequenceSample(uid));
      return resp.data;
    },
    successMessage: ({ uid }) => `UID ${uid} deleted successfully`,
  });
}

export default useDeleteSequenceUIDMutation;
