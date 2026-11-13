import React from 'react';
import { useMutation } from '@tanstack/react-query';
import useBackendHttpClient from '@opencloning/ui/hooks/useBackendHttpClient';
import { convertToTeselaJson } from '@opencloning/utils/readNwrite';
import error2String from '@opencloning/utils/error2String';
import { sequencingFileFromRef } from '../OpenCloningDBInterface';
import { MAX_CONCURRENT_CHECKS, buildSortedRows, percentIdentity, runWithConcurrency } from './sequencingCheckUtils';
import useSequencingQueries from './useSequencingQueries';

/**
 * Compare a sequencing file to its reference sequence. Plasmids are expected to match exactly, so if the
 * query has the same length as the reference, its seguid (computed by the backend with the topology of the
 * reference) is compared to the one stored in the database first, and the alignment is skipped if they match.
 *
 * The parsed file and the alignment come from useSequencingQueries, so they are reused by the alignment viewer
 * and the next checks (only the seguid is computed again). Failed alignments are not cached, so they are retried.
 * reference is { circular, length } of the sequence, parsed once per sequence.
 */
async function checkSequencingFile({ httpClient, getParsedFile, getAlignment }, { sequence, file, reference }) {
  const { sequence: query } = await getParsedFile(file);
  if (!query) {
    throw new Error('The file has no sequence');
  }

  if (sequence.seguid && query.length === reference.length) {
    try {
      const { data: querySeguid } = await httpClient.post('seguid', { sequence: query, circular: reference.circular });
      if (querySeguid === sequence.seguid) {
        return { status: 'match', identity: 100 };
      }
    } catch {
      // The seguid could not be computed (e.g. unexpected characters), the alignment decides
    }
  }

  const { alignedSequences } = await getAlignment(sequence, file);
  return { status: 'aligned', identity: percentIdentity(alignedSequences[0], alignedSequences[1]) };
}

/**
 * Check sequences (output of GetSequencesInBulkComponent) against their sequencing files.
 *
 * The sequencing files of each sequence come with the sequences (no request per sequence, which would
 * open many database connections at once), run() checks all the files, at most MAX_CONCURRENT_CHECKS
 * at the same time, and the rows are updated as each check finishes.
 */
export default function useSequencingCheck(sequences) {
  const httpClient = useBackendHttpClient();
  const { getParsedFile, getAlignment } = useSequencingQueries();
  const [results, setResults] = React.useState({});

  const filesBySequenceId = React.useMemo(() => Object.fromEntries(
    sequences.map(({ databaseId, sequencingFiles }) => [databaseId, sequencingFiles.map(sequencingFileFromRef)]),
  ), [sequences]);

  const references = React.useMemo(() => Object.fromEntries(sequences.map((sequence) => {
    const { circular, sequence: bases } = convertToTeselaJson(sequence.textFileSequence);
    return [sequence.databaseId, { circular, length: bases.length }];
  })), [sequences]);

  const jobs = React.useMemo(() => sequences.flatMap((sequence) => (filesBySequenceId[sequence.databaseId] ?? [])
    .map((file) => ({ sequence, file, reference: references[sequence.databaseId] }))), [sequences, filesBySequenceId, references]);

  const setResult = (fileId, result) => setResults((prev) => ({ ...prev, [fileId]: result }));

  const mutation = useMutation({
    mutationFn: async () => {
      setResults(Object.fromEntries(jobs.map(({ file }) => [file.id, { status: 'pending' }])));
      await runWithConcurrency(jobs, MAX_CONCURRENT_CHECKS, async (job) => {
        try {
          setResult(job.file.id, await checkSequencingFile({ httpClient, getParsedFile, getAlignment }, job));
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
    run: mutation.mutate,
    isRunning: mutation.isPending,
    progress: { done, total: jobs.length },
  };
}
