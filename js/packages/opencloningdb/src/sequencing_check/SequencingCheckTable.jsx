import React from 'react';
import { IconButton, Table, TableBody, TableCell, TableHead, TableRow, Tooltip } from '@mui/material';
import { Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon } from '@mui/icons-material';
import { StatusIcon } from '../bulk_upload/common';
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

const defaultRenderSequenceName = (sequence) => sequence.name;

function ViewAlignmentButton({ selected, onClick }) {
  const title = selected ? 'Hide alignment' : 'View alignment';
  return (
    <Tooltip title={title} placement="left">
      <IconButton size="small" onClick={onClick} aria-label={title} color={selected ? 'primary' : 'default'} data-testid="sequencing-check-view-alignment">
        {selected ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

function IssuesCell({ status, issues }) {
  return (
    <TableCell>
      {status !== 'clear' && issues.map((issue) => <div key={issue}>{issue}</div>)}
    </TableCell>
  );
}

/**
 * Rows from useSequencingCheck: one row per sequencing file, with the sequence cell spanning the rows of its files
 * (a single row with no file if the sequence has none). Each file has an eye button that calls
 * onViewAlignment(sequence, file), or onViewAlignment(null) if that file is the selected one (selectedFileId).
 */
export default function SequencingCheckTable({ rows, renderSequenceName = defaultRenderSequenceName, selectedFileId = null, onViewAlignment }) {
  return (
    <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%' }} data-testid="sequencing-check-table">
      <colgroup>
        <col style={{ width: '30%' }} />
        <col style={{ width: '48px' }} />
        <col style={{ width: '35%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '56px' }} />
        <col style={{ width: '25%' }} />
      </colgroup>
      <TableHead>
        <TableRow>
          <TableCell>Sequence</TableCell>
          <TableCell padding="checkbox"></TableCell>
          <TableCell>Sequencing file</TableCell>
          <TableCell>% identity</TableCell>
          <TableCell></TableCell>
          <TableCell>Notes</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const sequenceCell = (
            <TableCell
              rowSpan={Math.max(row.files.length, 1)}
              // Not highlighted with the selected file row
              sx={{ fontWeight: 'bold', verticalAlign: 'top', bgcolor: 'background.paper', overflowWrap: 'anywhere' }}
              data-testid="sequencing-check-sequence-cell"
            >
              <span data-testid="sequencing-check-sequence-name">{renderSequenceName(row.sequence)}</span>
            </TableCell>
          );
          if (row.files.length === 0) {
            // Files still loading, or no sequencing files
            return (
              <TableRow key={row.sequence.databaseId} data-testid="sequencing-check-empty-row">
                {sequenceCell}
                <TableCell align="center" padding="checkbox"><StatusIcon status={row.status} /></TableCell>
                <TableCell colSpan={3} />
                <IssuesCell status={row.status} issues={row.filesLoaded ? ['No sequencing data'] : []} />
              </TableRow>
            );
          }
          return row.files.map(({ file, result, status }, i) => {
            const selected = file.id === selectedFileId;
            return (
              <TableRow key={file.id} selected={selected} data-testid="sequencing-check-file-row">
                {i === 0 && sequenceCell}
                <TableCell align="center" padding="checkbox"><StatusIcon status={status} /></TableCell>
                <TableCell sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }} data-testid="sequencing-check-file-name">{file.name}</TableCell>
                <TableCell data-testid="sequencing-check-identity">{identityText(result)}</TableCell>
                <TableCell padding="none" align="center">
                  {onViewAlignment && (
                    <ViewAlignmentButton selected={selected} onClick={() => (selected ? onViewAlignment(null) : onViewAlignment(row.sequence, file))} />
                  )}
                </TableCell>
                <IssuesCell status={status} issues={fileIssues(result, status)} />
              </TableRow>
            );
          });
        })}
      </TableBody>
    </Table>
  );
}
