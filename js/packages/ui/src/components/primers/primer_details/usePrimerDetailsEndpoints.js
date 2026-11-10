import React, { useCallback } from 'react';
import useBackendHttpClient from '../../../hooks/useBackendHttpClient';
import { isEqual } from 'lodash-es';
import { useSelector } from 'react-redux';

const primerDetailsCache = new Map();
const heterodimerDetailsCache = new Map();
export function makePrimerDetailsCacheKey(sequence, globalPrimerSettings) {
  const settingsKey = JSON.stringify(globalPrimerSettings);
  return `${String(sequence)}::${settingsKey}`;
}
export function makeHeterodimerCacheKey(sequence1, sequence2, globalPrimerSettings) {
  const pairKey = [sequence1, sequence2].map(String).sort().join(',');
  const settingsKey = JSON.stringify(globalPrimerSettings);
  return `${pairKey}::${settingsKey}`;
}
export function usePrimerDetailsEndpoints() {
  const httpClient = useBackendHttpClient();
  const globalPrimerSettings = useSelector((state) => state.cloning.globalPrimerSettings, isEqual);

  // Caches are keyed by both the input sequence(s) and the current globalPrimerSettings,
  // so we don't need to clear them on settings change.

  const url = 'primer_details';
  const heterodimerUrl = 'primer_heterodimer';

  const getPrimerDetails = useCallback(async (sequence) => {
    const cacheKey = makePrimerDetailsCacheKey(sequence, globalPrimerSettings);
    if (!primerDetailsCache.has(cacheKey)) {
      const { data } = await httpClient.post(url, { sequence, settings: globalPrimerSettings });
      data.length = sequence.length;
      primerDetailsCache.set(cacheKey, data);
    }
    return primerDetailsCache.get(cacheKey);
  }, [url, httpClient, globalPrimerSettings]);

  const getHeterodimerDetails = useCallback(async (sequence1, sequence2) => {
    const cacheKey = makeHeterodimerCacheKey(sequence1, sequence2, globalPrimerSettings);
    if (!heterodimerDetailsCache.has(cacheKey)) {
      const { data } = await httpClient.post(heterodimerUrl, { sequence1, sequence2, settings: globalPrimerSettings });
      heterodimerDetailsCache.set(cacheKey, data);
    }
    return heterodimerDetailsCache.get(cacheKey);
  }, [heterodimerUrl, httpClient, globalPrimerSettings]);

  return { getPrimerDetails, getHeterodimerDetails };
}
