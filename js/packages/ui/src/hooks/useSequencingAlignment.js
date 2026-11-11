import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { buildAlignmentTrack, buildReferenceTrack, buildAlignmentConfig } from '@opencloning/utils/alignmentUtils';
import useBackendHttpClient from './useBackendHttpClient';

export default function useSequencingAlignment({ onError } = {}) {
  const httpClient = useBackendHttpClient();

  const fetchAlignments = useCallback(async ({ sequenceModel, sequenceData, parsedFiles }) => {
    // parsedFiles: [{ fileName, fileContent }] where fileContent is getTeselaJsonFromBase64 output
    const traces = parsedFiles.map((f) => f.fileContent.sequence);
    const resp = await httpClient.post('align_sanger', { sequence: sequenceModel, traces });

    const referenceTrack = buildReferenceTrack(sequenceData, resp.data[0]);
    const otherTracks = parsedFiles.map((f, i) => {
      const alignmentFile = { file_name: f.fileName, alignment: [resp.data[0], resp.data[i + 1]] }; // eslint-disable-line camelcase
      return buildAlignmentTrack(f.fileContent, alignmentFile);
    });

    return buildAlignmentConfig(sequenceModel.id, sequenceData, [referenceTrack, ...otherTracks]);
  }, [httpClient]);

  return useMutation({ mutationFn: fetchAlignments, onError });
}
