import React from 'react';
import { getBackendHttpClient } from '@opencloning/utils/httpClients';
import { useConfig } from './useConfig';

/**
 * Http client for the backend: urls are relative to config.backendUrl
 * (e.g. httpClient.post('validate', body)), and requests can only reach the backend.
 * For external urls use getExternalHttpClient() from @opencloning/utils/httpClients.
 */
export default function useBackendHttpClient() {
  const { backendUrl, requiresBackendAuth = false } = useConfig();

  return React.useMemo(
    () => getBackendHttpClient(backendUrl, { authenticated: requiresBackendAuth }),
    [backendUrl, requiresBackendAuth],
  );
}
