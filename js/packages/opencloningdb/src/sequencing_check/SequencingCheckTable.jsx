import React from 'react';
import { Box, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { CommonTableRow } from '../bulk_upload/common';
import { formatIdentity } from './sequencingCheckUtils';

function identityText(result) {
  return result?.identity === undefined ? '' : formatIdentity(result.identity);
}

function fileIssues(result, status) {
  if (status === 'error') {
    return [result.message || 'Check failed'];
  }
  if (status === 'warning') {
    return ['Identity below 100%'];
  }
  return [];
}

function sequenceIssues(row) {
  if (row.filesLoaded && row.files.length === 0) {
    return ['No sequencing data'];
  }
  if (row.status === 'error' || row.status === 'warning') {
    return ['See the sequencing files below'];
  }
  return [];
}

const defaultRenderSequenceName = (sequence) => sequence.name;

const subrowSx = { bgcolor: 'action.hover' };

/** Rows from useSequencingCheck: one row per sequence, followed by one subrow per sequencing file. */
export default function SequencingCheckTable({ rows, renderSequenceName = defaultRenderSequenceName }) {
  return (
    <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%' }} data-testid="sequencing-check-table">
      <colgroup>
        <col style={{ width: '48px' }} />
        <col style={{ width: '50%' }} />
        <col style={{ width: '15%' }} />
        <col style={{ width: '35%' }} />
      </colgroup>
      <TableHead>
        <TableRow>
          <TableCell padding="checkbox"></TableCell>
          <TableCell>Sequence / sequencing file</TableCell>
          <TableCell>% identity</TableCell>
          <TableCell>Notes</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <React.Fragment key={row.sequence.databaseId}>
            <CommonTableRow status={row.status} issues={sequenceIssues(row)} data-testid="sequencing-check-sequence-row">
              <TableCell sx={{ fontWeight: 'bold' }}>
                <span data-testid="sequencing-check-sequence-name">{renderSequenceName(row.sequence)}</span>
                {row.files.length > 0 && (
                  <Box component="span" sx={{ fontWeight: 'normal', color: 'text.secondary', ml: 1 }}>
                    ({row.files.length} file{row.files.length === 1 ? '' : 's'})
                  </Box>
                )}
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} data-testid="sequencing-check-identity">
                {row.identity === undefined ? '' : formatIdentity(row.identity)}
              </TableCell>
            </CommonTableRow>
            {row.files.map(({ file, result, status }) => (
              <CommonTableRow key={file.id} status={status} issues={fileIssues(result, status)} sx={subrowSx} data-testid="sequencing-check-file-row">
                <TableCell sx={{ pl: 4, fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{file.name}</TableCell>
                <TableCell data-testid="sequencing-check-identity">{identityText(result)}</TableCell>
              </CommonTableRow>
            ))}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
