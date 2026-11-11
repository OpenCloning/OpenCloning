// These functions are here because they are used across files,
// so including them in eLabFTWInterface.js would make circular dependencies.
// They are not included in common.js to be able to mock eLabFTWHttpClient in tests.
import { eLabFTWHttpClient, readHeaders } from './common';
import { encodePathSegment } from '@opencloning/utils/urlUtils';

export function error2String(error) {
  if (error.code === 'ERR_NETWORK') { return 'Network error: Cannot connect to eLabFTW'; }
  if (!error.code) {
    return error.message || 'Internal error, please contact the developers.';
  }

  if (error.response.status === 500) return 'Internal server error';
  const { description } = error.response.data;
  if (typeof description === 'string') {
    return description;
  }
  return 'Request error, please contact the developers.';
}

export const getFileFromELabFTW = async (itemId, fileInfo) => {
  const url = `/api/v2/items/${encodePathSegment(itemId)}/uploads/${encodePathSegment(fileInfo.id)}?format=binary`;
  try {
    const resp = await eLabFTWHttpClient.get(url, { headers: readHeaders, responseType: 'blob' });
    // Convert blob to file
    return new File([resp.data], fileInfo.real_name);
  } catch (e) {
    console.error(e);
    throw new Error(`${error2String(e)}`);
  }
};
