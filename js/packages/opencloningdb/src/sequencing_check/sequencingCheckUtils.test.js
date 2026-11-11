import { describe, it, expect } from 'vitest';
import {
  buildSortedRows,
  fileRowStatus,
  formatIdentity,
  percentIdentity,
  runWithConcurrency,
  sequenceRowStatus,
} from './sequencingCheckUtils';

describe('percentIdentity', () => {
  it('returns 100 for identical sequences, ignoring case', () => {
    expect(percentIdentity('ACGTACGTAC', 'acgtACGTac')).toBe(100);
  });

  it('counts mismatches', () => {
    expect(percentIdentity('ACGTACGTAC', 'ACGTTCGTAC')).toBe(90);
  });

  it('counts internal and terminal gaps as mismatches', () => {
    expect(percentIdentity('ACGTACGTAC', 'ACG-ACGTAC')).toBe(90);
    expect(percentIdentity('ACGTACGTAC', '--GTACGTAC')).toBe(80);
    expect(percentIdentity('ACGT-CGTAC', 'ACGTACGTAC')).toBe(90);
  });

  it('ignores columns where both sequences have a gap', () => {
    expect(percentIdentity('AC--GT', 'AC--GT')).toBe(100);
    expect(percentIdentity('AC--GT', 'AC--GA')).toBe(75);
  });

  it('returns 0 for empty alignments', () => {
    expect(percentIdentity('', '')).toBe(0);
    expect(percentIdentity('--', '--')).toBe(0);
  });

  it('throws if the aligned sequences have different lengths', () => {
    expect(() => percentIdentity('ACGT', 'ACG')).toThrow();
  });
});

describe('formatIdentity', () => {
  it('uses 2 decimals and never rounds up to 100', () => {
    expect(formatIdentity(100)).toBe('100.00');
    expect(formatIdentity(99.999)).toBe('99.99');
    expect(formatIdentity(87.5)).toBe('87.50');
  });
});

describe('runWithConcurrency', () => {
  it('runs all items, never more than limit at a time, and keeps the order of results', async () => {
    let active = 0;
    let maxActive = 0;
    const items = [5, 1, 8, 2, 7, 3, 6, 4, 9];
    const results = await runWithConcurrency(items, 4, async (item) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, item));
      active--;
      return item * 2;
    });
    expect(maxActive).toBe(4);
    expect(results).toEqual(items.map((item) => item * 2));
  });

  it('works with fewer items than the limit, and with no items', async () => {
    expect(await runWithConcurrency([1], 4, async (item) => item)).toEqual([1]);
    expect(await runWithConcurrency([], 4, async (item) => item)).toEqual([]);
  });
});

describe('fileRowStatus and sequenceRowStatus', () => {
  it('maps file results to StatusIcon statuses', () => {
    expect(fileRowStatus(undefined)).toBe(null);
    expect(fileRowStatus({ status: 'pending' })).toBe('pending');
    expect(fileRowStatus({ status: 'error', message: 'x' })).toBe('error');
    expect(fileRowStatus({ status: 'match', identity: 100 })).toBe('clear');
    expect(fileRowStatus({ status: 'aligned', identity: 100 })).toBe('clear');
    expect(fileRowStatus({ status: 'aligned', identity: 99.5 })).toBe('warning');
  });

  it('uses the worst status of the files, or info if there are no files', () => {
    const files = [{ id: 1 }, { id: 2 }];
    expect(sequenceRowStatus([], {})).toBe('info');
    expect(sequenceRowStatus(files, {})).toBe(null);
    expect(sequenceRowStatus(files, { 1: { status: 'match', identity: 100 }, 2: { status: 'match', identity: 100 } })).toBe('clear');
    expect(sequenceRowStatus(files, { 1: { status: 'match', identity: 100 }, 2: { status: 'pending' } })).toBe('pending');
    expect(sequenceRowStatus(files, { 1: { status: 'aligned', identity: 90 }, 2: { status: 'pending' } })).toBe('warning');
    expect(sequenceRowStatus(files, { 1: { status: 'aligned', identity: 90 }, 2: { status: 'error' } })).toBe('error');
  });
});

describe('buildSortedRows', () => {
  const sequences = [
    { databaseId: 1, name: 'perfect' },
    { databaseId: 2, name: 'no files' },
    { databaseId: 3, name: 'low' },
    { databaseId: 4, name: 'loading' },
    { databaseId: 5, name: 'error' },
    { databaseId: 6, name: 'not checked' },
  ];
  const filesBySequenceId = {
    1: [{ id: 10, name: 'a.fa' }],
    2: [],
    3: [{ id: 30, name: 'high.fa' }, { id: 31, name: 'low.fa' }],
    // 4 is still loading
    5: [{ id: 50, name: 'ok.fa' }, { id: 51, name: 'broken.fa' }],
    6: [{ id: 60, name: 'b.fa' }],
  };
  const results = {
    10: { status: 'match', identity: 100 },
    30: { status: 'aligned', identity: 99 },
    31: { status: 'aligned', identity: 80 },
    50: { status: 'aligned', identity: 100 },
    51: { status: 'error', message: 'Boom' },
  };

  it('sorts sequences: errors, lowest identity first, not checked or loading, no files last', () => {
    const rows = buildSortedRows(sequences, filesBySequenceId, results);
    expect(rows.map((row) => row.sequence.name)).toEqual(['error', 'low', 'perfect', 'loading', 'not checked', 'no files']);
  });

  it('sorts the files within each sequence and sets the identity of the sequence to the minimum', () => {
    const rows = buildSortedRows(sequences, filesBySequenceId, results);
    const low = rows.find((row) => row.sequence.name === 'low');
    expect(low.files.map(({ file }) => file.name)).toEqual(['low.fa', 'high.fa']);
    expect(low.identity).toBe(80);
    expect(low.status).toBe('warning');
    const error = rows.find((row) => row.sequence.name === 'error');
    expect(error.files.map(({ file }) => file.name)).toEqual(['broken.fa', 'ok.fa']);
    expect(error.status).toBe('error');
  });

  it('sets the status of sequences with no files and of sequences whose files are loading', () => {
    const rows = buildSortedRows(sequences, filesBySequenceId, results);
    const noFiles = rows.find((row) => row.sequence.name === 'no files');
    expect(noFiles.status).toBe('info');
    expect(noFiles.filesLoaded).toBe(true);
    expect(noFiles.identity).toBeUndefined();
    const loading = rows.find((row) => row.sequence.name === 'loading');
    expect(loading.status).toBe('pending');
    expect(loading.filesLoaded).toBe(false);
  });
});
