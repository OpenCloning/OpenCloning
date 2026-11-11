/**
 * Helpers for the bulk sequencing check (sequences vs. their sequencing files).
 *
 * A file result is one of:
 *   { status: 'pending' }                       - check in progress
 *   { status: 'match', identity: 100 }          - query seguid equals the reference seguid (no alignment needed)
 *   { status: 'aligned', identity: <number> }   - identity computed from the alignment
 *   { status: 'error', message: <string> }      - the check failed
 * Files that have not been checked yet have no result (undefined).
 */

/** Number of files checked at the same time. */
export const MAX_CONCURRENT_CHECKS = 4;

/**
 * Percentage identity of a pairwise alignment (gapped strings of the same length).
 * Columns where both strings have a gap are ignored, any other gap counts as a mismatch.
 */
export function percentIdentity(refAligned, queryAligned) {
  if (refAligned.length !== queryAligned.length) {
    throw new Error('Aligned sequences must have the same length');
  }
  const ref = refAligned.toUpperCase();
  const query = queryAligned.toUpperCase();
  let columns = 0;
  let matches = 0;
  for (let i = 0; i < ref.length; i++) {
    if (ref[i] === '-' && query[i] === '-') {
      continue;
    }
    columns++;
    if (ref[i] === query[i]) {
      matches++;
    }
  }
  return columns === 0 ? 0 : (100 * matches) / columns;
}

/** Format an identity with 2 decimals, rounding down so that anything below 100 never shows as 100. */
export function formatIdentity(identity) {
  return (Math.floor(identity * 100) / 100).toFixed(2);
}

/**
 * Call worker(item) for every item, with at most `limit` calls running at the same time.
 * Resolves with the results in the order of items. A rejected worker rejects the whole call,
 * so workers should handle their own errors.
 */
export async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runNext = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
  return results;
}

/** Status of a file for the StatusIcon in bulk_upload/common.jsx (null if not checked yet). */
export function fileRowStatus(result) {
  if (!result) {
    return null;
  }
  if (result.status === 'pending' || result.status === 'error') {
    return result.status;
  }
  return result.identity === 100 ? 'clear' : 'warning';
}

const STATUS_SEVERITY = ['error', 'warning', 'pending', null, 'clear'];

/** Status of a sequence row: 'info' if it has no sequencing files, otherwise the worst status of its files. */
export function sequenceRowStatus(files, results) {
  if (files.length === 0) {
    return 'info';
  }
  const statuses = files.map((file) => fileRowStatus(results[file.id]));
  return STATUS_SEVERITY.find((status) => statuses.includes(status));
}

/**
 * Sort key of a file, compared lexicographically: errors first, then identities (lowest first),
 * then files that are pending or not checked yet.
 */
function fileSortKey(result) {
  if (result?.status === 'error') {
    return [0, 0];
  }
  if (result?.identity !== undefined) {
    return [1, result.identity];
  }
  return [2, 0];
}

const NO_FILES_SORT_KEY = [3, 0];

function compareKeys(a, b) {
  return a[0] - b[0] || a[1] - b[1];
}

/**
 * Build the table rows from the sequences, their sequencing files and the results, sorted by
 * percentage identity (lowest first), both the sequences and the files within each sequence.
 * Sequences without sequencing files go last. The sort is stable, so ties keep the original order.
 *
 * @param {Array} sequences - [{ databaseId, name, ... }]
 * @param {Object} filesBySequenceId - { [databaseId]: [{ id, name, ... }] | undefined (loading) }
 * @param {Object} results - { [fileId]: result }
 * @returns {Array} [{ sequence, files: [{ file, result, status }], status, identity }]
 */
export function buildSortedRows(sequences, filesBySequenceId, results) {
  const rows = sequences.map((sequence) => {
    const files = (filesBySequenceId[sequence.databaseId] ?? [])
      .map((file) => ({ file, result: results[file.id], status: fileRowStatus(results[file.id]), sortKey: fileSortKey(results[file.id]) }))
      .sort((a, b) => compareKeys(a.sortKey, b.sortKey));
    const identities = files.map(({ result }) => result?.identity).filter((identity) => identity !== undefined);
    const filesLoaded = filesBySequenceId[sequence.databaseId] !== undefined;
    if (!filesLoaded) {
      return { sequence, files, filesLoaded, status: 'pending', identity: undefined, sortKey: fileSortKey(undefined) };
    }
    return {
      sequence,
      files,
      filesLoaded,
      status: sequenceRowStatus(files.map(({ file }) => file), results),
      identity: identities.length > 0 ? Math.min(...identities) : undefined,
      sortKey: files.length > 0 ? files[0].sortKey : NO_FILES_SORT_KEY,
    };
  });
  return rows.sort((a, b) => compareKeys(a.sortKey, b.sortKey));
}
