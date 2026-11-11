import axios from 'axios';
import { attachAuthInterceptors, setHttpClientTokenGetter, setHttpClientUnauthorizedHandler } from '@opencloning/utils/httpClientAuth';


export const baseUrl = `${import.meta.env?.VITE_OPENCLONING_DB_BACKEND || 'http://localhost:8000'}/db`;

export {
  setHttpClientTokenGetter,
  setHttpClientUnauthorizedHandler as setUnauthorizedHandler,
};

export function setWorkspaceHeader(id) {
  openCloningDBHttpClient.defaults.headers.common['X-Workspace-Id'] = id;
}

export function clearWorkspaceHeader() {
  delete openCloningDBHttpClient.defaults.headers.common['X-Workspace-Id'];
}

export const openCloningDBHttpClient = axios.create({
  baseURL: baseUrl,
  // Every url is appended to baseURL, so requests (and the auth token) only reach the backend
  allowAbsoluteUrls: false,
  paramsSerializer: (params) => {
    const searchParams = new URLSearchParams();

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((v) => {
          if (v !== undefined && v !== null) {
            searchParams.append(key, String(v));
          }
        });
      } else {
        searchParams.append(key, String(value));
      }
    });

    return searchParams.toString();
  },
});

attachAuthInterceptors(openCloningDBHttpClient);

export function formatSequenceName({ id, name, sample_uids: sampleUids }) {
  if (!name) return `Sequence ${id}`;
  let out = name;
  if (sampleUids && sampleUids.length > 0) {
    out += ` (${sampleUids.join(', ')})`;
  }
  return out;
}
