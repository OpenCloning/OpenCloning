import axios from 'axios';
import { attachAuthInterceptors } from './httpClientAuth';
import { urlMatchesPrefix } from './urlUtils';
import urlWhitelist from '../config/urlWhitelist';

/**
 * Client for requests that do not go to the backend (external services, static files):
 * no auth token, and only whitelisted urls (plus the current origin) are allowed.
 * For the backend, use getBackendHttpClient.
 */
export function getExternalHttpClient() {
  const baseURL = import.meta.env.BASE_URL || null;
  const whitelist = [...urlWhitelist, window.location.origin];
  if (baseURL) {
    whitelist.push(baseURL);
  }

  const client = axios.create();

  client.interceptors.request.use((config) => {
    const url = new URL(config.url, config.baseURL || window.location.origin);

    if (!whitelist.some((whitelistedUrl) => urlMatchesPrefix(url.href, whitelistedUrl))) {
      return Promise.reject(new Error(`Request blocked: URL not in whitelist ${url.href}`));
    }

    return config;
  }, (error) => Promise.reject(error));

  return client;
}

/**
 * Client that can only reach the backend: urls are relative to backendUrl, and
 * allowAbsoluteUrls: false makes axios append even absolute urls to backendUrl.
 * Only these clients carry the auth token. Use getExternalHttpClient() for external urls.
 */
export function getBackendHttpClient(backendUrl, { authenticated = false } = {}) {
  if (!backendUrl) {
    throw new Error('backendUrl is required to create a backend http client');
  }
  // Handles both absolute and relative urls
  const client = axios.create({ baseURL: new URL(backendUrl, window.location.origin).href, allowAbsoluteUrls: false });
  if (authenticated) {
    attachAuthInterceptors(client);
  }
  return client;
}
