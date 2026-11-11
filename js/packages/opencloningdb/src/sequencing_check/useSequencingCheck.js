import React from 'react';
import { useMutation, useQueries } from '@tanstack/react-query';
import useBackendHttpClient from '@opencloning/ui/hooks/useBackendHttpClient';
import { convertToTeselaJson, readSequencingFile } from '@opencloning/utils/readNwrite';
import error2String from '@opencloning/utils/error2String';
import OpenCloningDBInterface from '../OpenCloningDBInterface';
import { MAX_CONCURRENT_CHECKS, buildSortedRows, percentIdentity, runWithConcurrency } from './sequencingCheckUtils';

const { getSequencingFiles } = OpenCloningDBInterface;

/**
 * Compare a sequencing file to its reference sequence. Plasmids are expected to match exactly, so if the
 * query has the same length as the reference, its seguid (computed by the backend with the topology of the
 * reference) is compared to the one stored in the database first, and the alignment is skipped if they match.
 */
async function checkSequencingFile(httpClient, { file, reference }) {
  const { teselaJson } = await readSequencingFile(await file.getFile());
  const query = teselaJson.sequence;
  if (!query) {
    throw new Error('The file has no sequence');
  }

  if (reference.seguid && query.length === reference.length) {
    try {
      const { data: querySeguid } = await httpClient.post('seguid', { sequence: query, circular: reference.circular });
      if (querySeguid === reference.seguid) {
        return { status: 'match', identity: 100 };
      }
    } catch {
      // The seguid could not be computed (e.g. unexpected characters), the alignment decides
    }
  }

  const { data: alignment } = await httpClient.post('align_sanger', { sequence: reference.textFileSequence, traces: [query] });
  return { status: 'aligned', identity: percentIdentity(alignment[0], alignment[1]) };
}

/**
 * Defined outside the hook so that its reference is stable: useQueries then only re-runs it (and returns
 * a new object) when one of the queries changes, so filesData can be used as a memo dependency.
 * filesData[i] is the list of files of the i-th sequence, undefined while loading.
 */
function combineFilesQueries(queries) {
  return {
    filesData: queries.map((query) => query.data),
    filesError: queries.find((query) => query.error)?.error,
    filesLoading: queries.some((query) => query.isPending),
  };
}

/**
 * Check sequences (output of GetSequencesInBulkComponent) against their sequencing files.
 *
 * The sequencing files of each sequence are listed on mount, run() checks all the files, at most
 * MAX_CONCURRENT_CHECKS at the same time, and the rows are updated as each check finishes.
 */
export default function useSequencingCheck(sequences) {
  const httpClient = useBackendHttpClient();
  const [results, setResults] = React.useState({});

  // Same query key as the sequence detail page, so the cache is shared
  const { filesData, filesError, filesLoading } = useQueries({
    queries: sequences.map(({ databaseId }) => ({
      queryKey: ['sequence', databaseId, 'sequencing_files'],
      queryFn: () => getSequencingFiles(databaseId),
      retry: false,
    })),
    combine: combineFilesQueries,
  });

  const filesBySequenceId = React.useMemo(() => Object.fromEntries(
    sequences.map(({ databaseId }, i) => [databaseId, filesData[i]]),
  ), [sequences, filesData]);

  const references = React.useMemo(() => Object.fromEntries(sequences.map((sequence) => {
    const { circular, sequence: bases } = convertToTeselaJson(sequence.textFileSequence);
    return [sequence.databaseId, { textFileSequence: sequence.textFileSequence, seguid: sequence.seguid, circular, length: bases.length }];
  })), [sequences]);

  const jobs = React.useMemo(() => sequences.flatMap(({ databaseId }) => (filesBySequenceId[databaseId] ?? [])
    .map((file) => ({ file, reference: references[databaseId] }))), [sequences, filesBySequenceId, references]);

  const setResult = (fileId, result) => setResults((prev) => ({ ...prev, [fileId]: result }));

  const mutation = useMutation({
    mutationFn: async () => {
      setResults(Object.fromEntries(jobs.map(({ file }) => [file.id, { status: 'pending' }])));
      await runWithConcurrency(jobs, MAX_CONCURRENT_CHECKS, async (job) => {
        try {
          setResult(job.file.id, await checkSequencingFile(httpClient, job));
        } catch (error) {
          setResult(job.file.id, { status: 'error', message: error2String(error) });
        }
      });
    },
  });

  const rows = React.useMemo(() => buildSortedRows(sequences, filesBySequenceId, results), [sequences, filesBySequenceId, results]);
  const done = jobs.filter(({ file }) => results[file.id] && results[file.id].status !== 'pending').length;

  return {
    rows,
    filesLoading,
    filesError,
    run: mutation.mutate,
    isRunning: mutation.isPending,
    progress: { done, total: jobs.length },
  };
}
