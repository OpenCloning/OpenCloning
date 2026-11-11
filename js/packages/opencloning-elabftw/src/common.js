import axios from 'axios';
import { readApiKey, writeApiKey, baseUrl as envBaseUrl } from './envValues';

export const baseUrl = envBaseUrl;
export const readHeaders = readApiKey ? { Authorization: readApiKey } : {};
export const writeHeaders = writeApiKey ? { Authorization: writeApiKey } : {};

export const eLabFTWHttpClient = axios.create({
  baseURL: baseUrl,
  // Every url is appended to baseURL, so requests (and the API key) only reach eLabFTW
  allowAbsoluteUrls: false,
});

export const makeSequenceMetadata = (sequence) => JSON.stringify({
  extra_fields: {
    sequence: {
      type: 'text',
      value: sequence,
      group_id: null,
    },
  },
});

export const getELabFTWVersion = async () => {
  const url = `/api/v2/info`;
  const resp = await eLabFTWHttpClient.get(url, { headers: readHeaders });
  return resp.data.elabftw_version_int;
};
