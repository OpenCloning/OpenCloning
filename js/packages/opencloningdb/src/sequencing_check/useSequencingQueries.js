import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useBackendHttpClient from '@opencloning/ui/hooks/useBackendHttpClient';
import { readSequencingFile } from '@opencloning/utils/readNwrite';

/**
 * The content of a sequencing file and its alignment to a sequence do not change, so they never go stale.
 * They are kept for a while after nothing uses them (the parsed files may include chromatograms).
 * Failed queries are not cached, so they are retried the next time.
 */
const cacheOptions = { staleTime: Infinity, gcTime: 30 * 60 * 1000, retry: false };

/**
 * Cached sequencing file contents and alignments, shared by the sequencing check and the alignment viewer,
 * so that a file is downloaded and aligned at most once.
 *
 * - getParsedFile(file): parsed content (teselaJson) of a sequencing file (from the output of getSequencingFiles)
 * - getAlignment(sequence, file): alignment of a sequencing file to its sequence (an item of the output of
 *   GetSequencesInBulkComponent), { fileContent, alignedSequences } where alignedSequences is the align_sanger
 *   response ([aligned reference, aligned file])
 * - alignmentQuery(sequence, file): the query options of getAlignment, to use with useQuery
 */
export default function useSequencingQueries() {
  const queryClient = useQueryClient();
  const httpClient = useBackendHttpClient();

  return React.useMemo(() => {
    const getParsedFile = (file) => queryClient.ensureQueryData({
      queryKey: ['sequencing_file', file.id, 'parsed'],
      queryFn: async () => (await readSequencingFile(await file.getFile())).teselaJson,
      ...cacheOptions,
    });

    const alignmentQuery = (sequence, file) => ({
      queryKey: ['sequence', sequence.databaseId, 'sequencing_alignment', file.id],
      queryFn: async () => {
        const fileContent = await getParsedFile(file);
        const { data: alignedSequences } = await httpClient.post('align_sanger', {
          sequence: sequence.textFileSequence,
          traces: [fileContent.sequence],
        });
        return { fileContent, alignedSequences };
      },
      ...cacheOptions,
    });

    const getAlignment = (sequence, file) => queryClient.ensureQueryData(alignmentQuery(sequence, file));

    return { getParsedFile, getAlignment, alignmentQuery };
  }, [queryClient, httpClient]);
}
