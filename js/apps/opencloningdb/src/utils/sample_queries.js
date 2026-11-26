import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';

/** Query of the samples of the workspace whose UID contains uid (case-insensitive), with their sequence and files. */
export const sampleSearchQuery = (uid) => ({
  queryKey: ['sequence_samples', { uid }],
  queryFn: async () => {
    const { data } = await openCloningDBHttpClient.get(endpoints.sequenceSamples, { params: { uid } });
    return data.items;
  },
});
