import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import { sampleUidError } from './sample_uid';

/** The sample whose UID is uid (case-insensitive), with its sequence and files, or null if there is none. */
export async function fetchSampleByUid(uid) {
  // No sample can have an invalid UID, and the request would go to another route (e.g. 'S1/sequencing_files')
  if (sampleUidError(uid)) {
    return null;
  }
  try {
    const { data } = await openCloningDBHttpClient.get(endpoints.sequenceSample(uid));
    return data;
  } catch (e) {
    if (e.response?.status === 404) {
      return null;
    }
    throw e;
  }
}

/**
 * Query of the samples of the workspace whose UID contains uid (case-insensitive), with their sequence and files.
 * Only the first page of the search is returned, but the sample whose UID is exactly uid is always included if it
 * exists.
 */
export const sampleSearchQuery = (uid) => ({
  queryKey: ['sequence_samples', { uid }],
  queryFn: async () => {
    const { data } = await openCloningDBHttpClient.get(endpoints.sequenceSamples, { params: { uid } });
    const hasExact = data.items.some((sample) => sample.uid.toLowerCase() === uid.toLowerCase());
    if (hasExact || data.total <= data.items.length) {
      return data.items;
    }
    const exact = await fetchSampleByUid(uid);
    return exact ? [exact, ...data.items] : data.items;
  },
});
