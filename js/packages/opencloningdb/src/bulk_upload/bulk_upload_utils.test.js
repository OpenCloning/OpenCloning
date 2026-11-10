import { cloningStrategyRowIssues, cloningStrategyRowStatus, getCloningStrategyRowsInfo, rowsToCloningStrategySyncResults } from './bulk_upload_utils';

const clearRow = { file_name: 'clear.json', cloning_strategy: {} };
const errorRow = { file_name: 'error.json', parsing_errors: ['Cloning strategy is not valid JSON'] };
const syncedRow = { file_name: 'synced.json', cloning_strategy: {}, already_synced: true };
const parsingWarningRow = { file_name: 'warning.json', cloning_strategy: {}, parsing_warnings: ['old schema'] };
const primerMismatchRow = {
  file_name: 'primer.json',
  cloning_strategy: {},
  primer_database_id_mismatches: [{ primer_id: 3, kind: 'not_in_database', provided_database_id: 7 }],
};
const sequenceMismatchRow = {
  file_name: 'sequence.json',
  cloning_strategy: {},
  sequence_database_id_mismatches: [{ sequence_id: 2, kind: 'different_sequence', provided_database_id: 10 }],
};

describe('cloningStrategyRowStatus', () => {
  it('returns the status of each kind of row', () => {
    expect(cloningStrategyRowStatus(clearRow)).toBe('clear');
    expect(cloningStrategyRowStatus(errorRow)).toBe('error');
    expect(cloningStrategyRowStatus(syncedRow)).toBe('info');
    expect(cloningStrategyRowStatus(parsingWarningRow)).toBe('warning');
    expect(cloningStrategyRowStatus(primerMismatchRow)).toBe('warning');
    expect(cloningStrategyRowStatus(sequenceMismatchRow)).toBe('warning');
  });

  it('gives precedence to errors, then already synced, then warnings', () => {
    expect(cloningStrategyRowStatus({ ...syncedRow, ...parsingWarningRow, parsing_errors: ['bad'] })).toBe('error');
    expect(cloningStrategyRowStatus({ ...parsingWarningRow, ...primerMismatchRow, already_synced: true })).toBe('info');
  });
});

describe('cloningStrategyRowIssues', () => {
  it('returns no issues for a clear row', () => {
    expect(cloningStrategyRowIssues(clearRow)).toEqual([]);
  });

  it('lists errors, warnings, mismatches and sync state', () => {
    const row = {
      ...primerMismatchRow,
      ...sequenceMismatchRow,
      parsing_errors: ['error 1'],
      parsing_warnings: ['warning 1'],
      already_synced: true,
    };
    expect(cloningStrategyRowIssues(row)).toEqual([
      'error 1',
      'warning 1',
      'Primer 3 database_id mismatch: not in database (provided 7)',
      'Sequence 2 database_id mismatch: different sequence (provided 10)',
      'Already synced to this workspace',
    ]);
  });
});

describe('getCloningStrategyRowsInfo', () => {
  it('orders rows (errors, warnings, info, clear) and counts them', () => {
    const rows = [clearRow, syncedRow, parsingWarningRow, errorRow, sequenceMismatchRow];
    const info = getCloningStrategyRowsInfo(rows);
    expect(info.orderedRows).toEqual([errorRow, parsingWarningRow, sequenceMismatchRow, syncedRow, clearRow]);
    expect(info.clearRows).toEqual([clearRow]);
    expect(info.clearAndWarningRows).toEqual([parsingWarningRow, sequenceMismatchRow, clearRow]);
    expect(info.errorRowsCount).toBe(1);
    expect(info.warningRowsCount).toBe(2);
    expect(info.infoRowsCount).toBe(1);
    expect(info.clearRowsCount).toBe(1);
    expect(info.totalRowsCount).toBe(5);
  });
});

describe('rowsToCloningStrategySyncResults', () => {
  it('keeps the rows with a strategy that are not synced, with only file_name and cloning_strategy', () => {
    const rows = [clearRow, syncedRow, parsingWarningRow, errorRow, sequenceMismatchRow];
    expect(rowsToCloningStrategySyncResults(rows)).toEqual([
      { file_name: 'clear.json', cloning_strategy: {} },
      { file_name: 'warning.json', cloning_strategy: {} },
      { file_name: 'sequence.json', cloning_strategy: {} },
    ]);
  });

  it('returns an empty array if nothing can be submitted', () => {
    expect(rowsToCloningStrategySyncResults([syncedRow, errorRow])).toEqual([]);
  });
});
