import { extractFilesFromZip } from '@opencloning/utils/readNwrite';
import { SEQUENCE_TYPE_LABELS } from './query_utils';

export const VALID_TEMPLATE_SEQUENCE_TYPE_KEYS = Object.keys(SEQUENCE_TYPE_LABELS);

export function normalizeTemplateSequenceSubmission(row) {
  return {
    name: String(row.name ?? '').trim(),
    sequence_type: String(row.sequence_type ?? '').trim(),
  };
}

export function parseTemplateSequenceTypes(rows) {
  const invalidTypes = new Set();
  const items = rows.map((row) => {
    const normalized = normalizeTemplateSequenceSubmission(row);
    if (!VALID_TEMPLATE_SEQUENCE_TYPE_KEYS.includes(normalized.sequence_type)) {
      if (normalized.sequence_type) {
        invalidTypes.add(normalized.sequence_type);
      } else {
        invalidTypes.add('(empty)');
      }
    }
    return normalized;
  });
  return { items, invalidTypes: [...invalidTypes] };
}

export function prepareTemplateSequenceRowsForValidation(rows) {
  if (!Array.isArray(rows) || rows.length < 1) {
    throw new Error('File does not contain template sequence rows');
  }

  const { items, invalidTypes } = parseTemplateSequenceTypes(rows);
  if (invalidTypes.length > 0) {
    throw new Error(
      `Invalid sequence_type value(s): ${invalidTypes.join(', ')}. Valid values: ${VALID_TEMPLATE_SEQUENCE_TYPE_KEYS.join(', ')}`,
    );
  }

  const normalizedItems = items.filter((item) => item.name.length > 0);
  if (normalizedItems.length < 1) {
    throw new Error('File does not contain template sequence rows with names');
  }

  return normalizedItems;
}

export function templateSequenceRowIssues(row) {
  const issues = [];
  if (row.sequence_type_invalid) issues.push('Invalid sequence_type');
  if (row.name_exists) issues.push('Name already exists in workspace');
  if (row.name_duplicated) issues.push('Name duplicated in uploaded file');
  return issues;
}

export function templateSequenceRowStatus(row) {
  return templateSequenceRowIssues(row).length > 0 ? 'error' : 'clear';
}

export function splitSpaceSeparatedField(value) {
  return String(value ?? '').trim().split(/\s+/).filter(Boolean);
}

export function normalizeLineSubmission(row) {
  return {
    uid: String(row.uid ?? '').trim(),
    genotype: splitSpaceSeparatedField(row.genotype),
    plasmids: splitSpaceSeparatedField(row.plasmids),
    parent_uids: splitSpaceSeparatedField(row.parent_uids),
  };
}

export function prepareLineRowsForValidation(rows) {
  if (!Array.isArray(rows) || rows.length < 1) {
    throw new Error('File does not contain line rows');
  }

  const items = rows.map(normalizeLineSubmission);
  const rowsWithMissingUid = items.filter((item) => item.uid.length < 1);
  if (rowsWithMissingUid.length > 0) {
    throw new Error('File contains line rows without a UID');
  }

  const tooManyParents = items.find((item) => item.parent_uids.length > 2);
  if (tooManyParents) {
    throw new Error(`Line "${tooManyParents.uid}" has more than two parent UIDs`);
  }

  return items;
}

function lineBulkSequenceNameFlagIssues(flags, label) {
  const issues = [];
  (flags ?? []).forEach((flag) => {
    if (flag.not_found) issues.push(`${label} "${flag.name}" not found`);
    if (flag.ambiguous) issues.push(`${label} "${flag.name}" is ambiguous`);
    if (flag.duplicated) issues.push(`${label} "${flag.name}" duplicated in uploaded file`);
  });
  return issues;
}

export function lineBulkRowIssues(row) {
  const issues = [];
  if (row.uid_exists) issues.push('UID already exists in workspace');
  if (row.uid_duplicated) issues.push('UID duplicated in uploaded file');
  issues.push(...lineBulkSequenceNameFlagIssues(row.genotype_flags, 'Genotype'));
  issues.push(...lineBulkSequenceNameFlagIssues(row.plasmid_flags, 'Plasmid'));
  (row.parent_flags ?? []).forEach((flag) => {
    if (flag.line_id == null) {
      issues.push(`Parent UID "${flag.uid}" not found`);
    }
  });
  return issues;
}

export function lineBulkRowStatus(row) {
  return lineBulkRowIssues(row).length > 0 ? 'error' : 'clear';
}

export function getLineBulkRowsInfo(rows) {
  const errorRows = rows.filter((row) => lineBulkRowStatus(row) === 'error');
  const clearRows = rows.filter((row) => lineBulkRowStatus(row) === 'clear');
  const orderedRows = [...errorRows, ...clearRows];
  return {
    errorRows,
    warningRows: [],
    clearRows,
    orderedRows,
    clearAndWarningRows: clearRows,
    clearRowsCount: clearRows.length,
    warningRowsCount: 0,
    errorRowsCount: errorRows.length,
    totalRowsCount: rows.length,
  };
}

export function formatLineBulkList(values) {
  return (values ?? []).join(' ') || '—';
}

export function getTemplateSequenceRowsInfo(rows) {
  const errorRows = rows.filter((row) => templateSequenceRowStatus(row) === 'error');
  const clearRows = rows.filter((row) => templateSequenceRowStatus(row) === 'clear');
  const orderedRows = [...errorRows, ...clearRows];
  return {
    errorRows,
    warningRows: [],
    clearRows,
    orderedRows,
    clearAndWarningRows: clearRows,
    clearRowsCount: clearRows.length,
    warningRowsCount: 0,
    errorRowsCount: errorRows.length,
    totalRowsCount: rows.length,
  };
}

export function rowIssues(row) {
  const issues = [];
  if (row.sequence_invalid) issues.push('Invalid DNA sequence');
  if (row.name_exists) issues.push('Name already exists in workspace');
  if (row.sequence_exists) issues.push('Sequence already exists in workspace');
  if (row.uid_exists) issues.push('UID already exists in workspace');
  if (row.name_duplicated) issues.push('Name duplicated in uploaded file');
  if (row.sequence_duplicated) issues.push('Sequence duplicated in uploaded file');
  if (row.uid_duplicated) issues.push('UID duplicated in uploaded file');
  return issues;
}

export function primerRowStatus(row) {
  if (row.uid_exists || row.uid_duplicated || row.sequence_invalid) {
    return 'error';
  }
  if (rowIssues(row).length > 0) {
    return 'warning';
  }
  return 'clear';
}

export function normalizePrimerSubmission(primer) {
  const name = String(primer.name ?? '').trim();
  const sequence = String(primer.sequence ?? '').trim().replace(/[^a-zA-Z0-9]/g, '');
  const uid = String(primer.uid ?? '').trim();
  return {
    name,
    sequence,
    uid: uid.length > 0 ? uid : null,
  };
}

export function getPrimerRowsInfo(rows) {
  const errorRows = rows.filter((row) => primerRowStatus(row) === 'error');
  const warningRows = rows.filter((row) => primerRowStatus(row) === 'warning');
  const clearRows = rows.filter((row) => primerRowStatus(row) === 'clear');
  const orderedRows = [...errorRows, ...warningRows, ...clearRows];
  const clearAndWarningRows = [...warningRows, ...clearRows];
  const clearRowsCount = clearRows.length;
  const warningRowsCount = warningRows.length;
  const errorRowsCount = errorRows.length;
  const totalRowsCount = rows.length;
  return { errorRows, warningRows, clearRows, orderedRows, clearRowsCount, warningRowsCount, errorRowsCount, totalRowsCount, clearAndWarningRows };
}

export function sequenceRowIssues(row) {
  const issues = [];
  if (row.reading_error) issues.push('Unable to parse sequence file');
  if (row.name_exists) issues.push('Name already exists in workspace');
  if (row.sequence_exists) issues.push('Sequence already exists in workspace');
  if (row.sequence_circularised_exists) issues.push('Circularized sequence already exists in workspace');
  if (row.duplicated_name) issues.push('Name duplicated in uploaded files');
  if (row.duplicated_seguid) issues.push('Sequence duplicated in uploaded files');
  return issues;
}

export function sequenceRowStatus(row) {
  if (row.reading_error) {
    return 'error';
  }
  return sequenceRowIssues(row).length > 0 ? 'warning' : 'clear';
}

export function getSequenceRowsInfo(rows) {
  const errorRows = rows.filter((row) => sequenceRowStatus(row) === 'error');
  const warningRows = rows.filter((row) => sequenceRowStatus(row) === 'warning');
  const clearRows = rows.filter((row) => sequenceRowStatus(row) === 'clear');
  const orderedRows = [...errorRows, ...warningRows, ...clearRows];
  const clearAndWarningRows = [...warningRows, ...clearRows];
  const clearRowsCount = clearRows.length;
  const warningRowsCount = warningRows.length;
  const errorRowsCount = errorRows.length;
  const totalRowsCount = rows.length;
  return {
    errorRows,
    warningRows,
    clearRows,
    orderedRows,
    clearAndWarningRows,
    clearRowsCount,
    warningRowsCount,
    errorRowsCount,
    totalRowsCount,
  };
}

const FINAL_FASTQ_SUFFIX = '.final.fastq';

/** Sample name of a sequencing run file, e.g. 'A1-P1' for 'A1-P1.final.fastq'. */
export const fastqSampleName = (file) => file.name.slice(0, -FINAL_FASTQ_SUFFIX.length);

/** The *.final.fastq files of a zipped sequencing run, with one folder per sample. */
export async function finalFastqFilesFromZip(zipFile) {
  const files = await extractFilesFromZip(zipFile, (path) => path.toLowerCase().endsWith(FINAL_FASTQ_SUFFIX));
  const names = files.map((file) => file.name);
  const repeated = [...new Set(names.filter((name, i) => names.indexOf(name) !== i))];
  if (repeated.length > 0) {
    throw new Error(`Several files with the same name in the zip file: ${repeated.join(', ')}`);
  }
  return files;
}

/**
 * A row of the table to link a sequencing file to a sample:
 * - uid: UID of the sample the file goes to, null if not chosen yet
 * - sample: the existing sample with that UID (with its sequence), null for a new sample
 * - sequence: the sequence of the sample: that of the existing sample, or the one chosen for the new sample (null
 *   if not chosen yet)
 * - matchedByRead: the sequence was found by "Find exact matches" (the read is that sequence)
 * - candidates: sequences found by "Find exact matches" when there were several, for the user to choose
 * - skip: the file is not linked
 */
export const linkRow = (file, sample = null) => ({
  sampleName: fastqSampleName(file),
  file,
  uid: sample?.uid ?? null,
  sample,
  sequence: sample?.sequence ?? null,
  matchedByRead: false,
  candidates: [],
  skip: false,
});

/**
 * The row with another sample, target ({ uid, sample }, sample null for a new sample, see SampleTargetSelect), or
 * without sample if target is null. A new sample keeps the sequence of the previous sample (existing or new).
 */
export function withTarget(row, target) {
  if (!target) {
    return { ...row, uid: null, sample: null, sequence: null, matchedByRead: false };
  }
  if (target.sample) {
    return { ...row, uid: target.uid, sample: target.sample, sequence: target.sample.sequence, matchedByRead: false };
  }
  // The sequence of an existing sample was not matched by read
  return { ...row, uid: target.uid, sample: null, matchedByRead: !row.sample && row.matchedByRead };
}

/**
 * The row with the sequences that are exactly its read (see "Find exact matches"), null if the file could not be
 * read: a new sample named as the file with the sequence if there is one, the candidates to choose from if there
 * are several. Rows with a sample, skipped, or without matches are not changed.
 */
export function withMatches(row, matches) {
  if (!matches?.length || row.skip || row.uid) {
    return row;
  }
  const single = matches.length === 1;
  return {
    ...row,
    uid: row.sampleName,
    sample: null,
    sequence: single ? matches[0] : null,
    matchedByRead: single,
    candidates: single ? [] : matches,
  };
}

/** The existing sample of the row already has a sequencing file with the name of the file. */
export const isAlreadyLinked = (row) => Boolean(row.sample?.sequencing_files?.some(({ original_name: name }) => name === row.file.name));

/** The file of the row is linked when submitting: not skipped, and not already linked to its sample. */
const isLinked = (row) => !row.skip && !isAlreadyLinked(row);

/**
 * Status of each row: { status, duplicates, conflict, blocking }
 * - status: 'skip', 'already_linked' (the existing sample already has the file, not linked again), 'existing'
 *   (existing sample), 'new' (new sample with its sequence), 'no_sample' (no sample chosen), 'no_sequence' (new
 *   sample without sequence)
 * - duplicates: sample names of the other rows that link a file to the same sample (allowed, e.g. two reads of
 *   the same colony, but flagged in case it is a mistake)
 * - conflict: the rows that create this new sample give it different sequences
 * - blocking: the files cannot be linked until this is fixed
 */
export function linkRowStatuses(rows) {
  const byUid = {};
  rows.forEach((row) => {
    if (isLinked(row) && row.uid) {
      const key = row.uid.toLowerCase();
      byUid[key] = [...(byUid[key] ?? []), row];
    }
  });
  return rows.map((row) => {
    if (row.skip) {
      return { status: 'skip', duplicates: [], conflict: false, blocking: false };
    }
    if (isAlreadyLinked(row)) {
      return { status: 'already_linked', duplicates: [], conflict: false, blocking: false };
    }
    if (!row.uid) {
      return { status: 'no_sample', duplicates: [], conflict: false, blocking: true };
    }
    const sameUid = byUid[row.uid.toLowerCase()];
    const duplicates = sameUid.filter((other) => other !== row).map((other) => other.sampleName);
    if (row.sample) {
      return { status: 'existing', duplicates, conflict: false, blocking: false };
    }
    const sequenceIds = new Set(sameUid.filter((other) => !other.sample && other.sequence).map((other) => other.sequence.id));
    const conflict = sequenceIds.size > 1;
    const status = row.sequence ? 'new' : 'no_sequence';
    return { status, duplicates, conflict, blocking: conflict || status === 'no_sequence' };
  });
}

/** The rows that are linked, as [{ sampleUid, sequenceId, file }], sequenceId '' for existing samples. */
export function linkEntries(rows) {
  return rows
    .filter(isLinked)
    .map((row) => ({ sampleUid: row.uid, sequenceId: row.sample ? '' : String(row.sequence?.id ?? ''), file: row.file }));
}

/** Number of samples that linking the rows creates. */
export function newSampleCount(rows) {
  return new Set(rows.filter((row) => !row.skip && row.uid && !row.sample).map((row) => row.uid.toLowerCase())).size;
}
