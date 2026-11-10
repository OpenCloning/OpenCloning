/** Helpers to display the validation rows returned by the cloning strategy bulk validate endpoint. */

function formatMismatchKind(kind) {
  return String(kind ?? '').replaceAll('_', ' ');
}

export function cloningStrategyRowIssues(row) {
  const issues = [];
  (row.parsing_errors ?? []).forEach((error) => issues.push(error));
  (row.parsing_warnings ?? []).forEach((warning) => issues.push(warning));
  (row.primer_database_id_mismatches ?? []).forEach((mismatch) => {
    issues.push(
      `Primer ${mismatch.primer_id} database_id mismatch: ${formatMismatchKind(mismatch.kind)} (provided ${mismatch.provided_database_id})`,
    );
  });
  (row.sequence_database_id_mismatches ?? []).forEach((mismatch) => {
    issues.push(
      `Sequence ${mismatch.sequence_id} database_id mismatch: ${formatMismatchKind(mismatch.kind)} (provided ${mismatch.provided_database_id})`,
    );
  });
  if (row.already_synced) {
    issues.push('Already synced to this workspace');
  }
  return issues;
}

export function cloningStrategyRowStatus(row) {
  if ((row.parsing_errors ?? []).length > 0) {
    return 'error';
  }
  if (row.already_synced) {
    return 'info';
  }
  if ((row.parsing_warnings ?? []).length > 0) {
    return 'warning';
  }
  if ((row.primer_database_id_mismatches ?? []).length > 0) {
    return 'warning';
  }
  if ((row.sequence_database_id_mismatches ?? []).length > 0) {
    return 'warning';
  }
  return 'clear';
}

export function getCloningStrategyRowsInfo(rows) {
  const errorRows = rows.filter((row) => cloningStrategyRowStatus(row) === 'error');
  const warningRows = rows.filter((row) => cloningStrategyRowStatus(row) === 'warning');
  const infoRows = rows.filter((row) => cloningStrategyRowStatus(row) === 'info');
  const clearRows = rows.filter((row) => cloningStrategyRowStatus(row) === 'clear');
  const orderedRows = [...errorRows, ...warningRows, ...infoRows, ...clearRows];
  const clearAndWarningRows = [...warningRows, ...clearRows];
  return {
    errorRows,
    warningRows,
    infoRows,
    clearRows,
    orderedRows,
    clearAndWarningRows,
    clearRowsCount: clearRows.length,
    warningRowsCount: warningRows.length,
    infoRowsCount: infoRows.length,
    errorRowsCount: errorRows.length,
    totalRowsCount: rows.length,
  };
}

/** The rows that can be submitted (not already synced, with a cloning strategy), in the format of the submit endpoint. */
export function rowsToCloningStrategySyncResults(rows) {
  return rows
    .filter((row) => !row.already_synced && row.cloning_strategy)
    .map(({ file_name: fileName, cloning_strategy: cloningStrategy }) => ({
      ['file_name']: fileName,
      ['cloning_strategy']: cloningStrategy,
    }));
}
