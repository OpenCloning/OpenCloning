import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { buildSequencingAlignmentConfig } from '@opencloning/utils/alignmentUtils';
import useBackendHttpClient from './useBackendHttpClient';

export default function useSequencingAlignment({ onError } = {}) {
  const httpClient = useBackendHttpClient();

  const fetchAlignments = useCallback(async ({ sequenceModel, sequenceData, parsedFiles }) => {
    // parsedFiles: [{ fileName, fileContent }] where fileContent is getTeselaJsonFromBase64 output
    const traces = parsedFiles.map((f) => f.fileContent.sequence);
    const resp = await httpClient.post('align_sanger', { sequence: sequenceModel, traces });
    return buildSequencingAlignmentConfig(sequenceModel, sequenceData, parsedFiles, resp.data);
  }, [httpClient]);

  return useMutation({ mutationFn: fetchAlignments, onError });
}
