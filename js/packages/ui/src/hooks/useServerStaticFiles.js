import React from 'react';
import { getExternalHttpClient } from '@opencloning/utils/httpClients';
import { useConfig } from '../providers';
import useRequestForEffect from './useRequestForEffect';


export const localFilesHttpClient = getExternalHttpClient();

function sequencesToCategories(sequences) {
  const allCategories = sequences
    .map((s) => s.categories)
    .flat()
    .filter(Boolean);
  return Array.from(new Set(allCategories)).sort((a, b) => a.localeCompare(b));
}
export default function useServerStaticFiles() {
  const [index, setIndex] = React.useState(null);

  const config = useConfig();
  const httpClient = localFilesHttpClient;
  const staticContentPath = `${import.meta.env.BASE_URL}${config.staticContentPath}`;

  const requestFunction = React.useCallback(async () => {
    const resp = await httpClient.get(`${staticContentPath}/index.json`);
    return resp.data;
  }, [staticContentPath, httpClient]);

  const onSuccess = React.useCallback((data) => {
    const sequences = !data.sequences ? [] : data.sequences;
    const syntaxes = !data.syntaxes ? [] : data.syntaxes;
    const categories = sequencesToCategories(sequences);
    setIndex({ sequences, syntaxes, categories });
  }, []);

  const { requestStatus: indexRequestStatus, retry: indexRetry } = useRequestForEffect({ requestFunction, onSuccess });

  const requestFile = React.useCallback(async (path) => {
    const resp = await httpClient.get(`${staticContentPath}/${path}`);
    return resp.data;
  }, [staticContentPath, httpClient]);

  return React.useMemo(() => (
    !staticContentPath ? null :
      {
        index,
        indexRequestStatus,
        indexRetry,
        requestFile
      }),
  [
    index,
    indexRequestStatus,
    indexRetry,
    requestFile,
    staticContentPath]);
}
