import React from 'react';
import { Box, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Tooltip } from '@mui/material';
import { Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon } from '@mui/icons-material';
import { StatusIcon } from '../bulk_upload/common';
import SampleUidLabel from '../SampleUidLabel';
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
    <TableCell sx={{ overflowWrap: 'anywhere' }}>
      {status !== 'clear' && issues.map((issue) => <div key={issue}>{issue}</div>)}
    </TableCell>
  );
}

// Spanning cells are not highlighted with the selected file row
const spanningCellSx = { verticalAlign: 'top', bgcolor: 'background.paper', overflowWrap: 'anywhere' };
// Long UIDs wrap inside the label, rather than the label breaking across lines
const sampleLabelSx = { display: 'inline-block', maxWidth: '100%' };

/**
 * Rows from useSequencingCheck: one row per sequencing file, with the sequence cell spanning the rows of its files
 * (a single row with no file if the sequence has none), and the sample cell spanning the rows of the files of that
 * sample. Each file has an eye button that calls onViewAlignment(sequence, file), or onViewAlignment(null) if that
 * file is the selected one (selectedFileId).
 */
export default function SequencingCheckTable({ rows, renderSequenceName = defaultRenderSequenceName, selectedFileId = null, onViewAlignment }) {
  // The table gets shorter when the alignment is shown (once it is loaded), keep the selected file visible
  const tableRef = React.useRef(null);
  const selectedRowRef = React.useRef(null);
  React.useEffect(() => {
    const scrollContainer = tableRef.current?.parentElement;
    if (selectedFileId === null || !scrollContainer) {
      return undefined;
    }
    const observer = new ResizeObserver(() => selectedRowRef.current?.scrollIntoView({ block: 'nearest' }));
    observer.observe(scrollContainer);
    return () => observer.disconnect();
  }, [selectedFileId]);

  return (
    <Table ref={tableRef} stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%' }} data-testid="sequencing-check-table">
      <colgroup>
        <Box component="col" sx={{ width: '18%' }} />
        <Box component="col" sx={{ width: '22%' }} />
        <Box component="col" sx={{ width: '48px' }} />
        <Box component="col" sx={{ width: '25%' }} />
        <Box component="col" sx={{ width: '104px' }} />
        <Box component="col" sx={{ width: '56px' }} />
        <Box component="col" sx={{ width: '27%' }} />
      </colgroup>
      <TableHead>
        <TableRow>
          <TableCell>Sequence</TableCell>
          <TableCell>Sample</TableCell>
          <TableCell padding="checkbox"></TableCell>
          <TableCell>Sequencing file</TableCell>
          <TableCell sx={{ whiteSpace: 'nowrap' }}>% identity</TableCell>
          <TableCell></TableCell>
          <TableCell>Notes</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const sequenceCell = (
            <TableCell
              rowSpan={Math.max(row.files.length, 1)}
              sx={{ ...spanningCellSx, fontWeight: 'bold' }}
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
                <TableCell />
                <TableCell align="center" padding="checkbox"><StatusIcon status={row.status} /></TableCell>
                <TableCell colSpan={3} />
                <IssuesCell status={row.status} issues={row.filesLoaded ? ['No sequencing data'] : []} />
              </TableRow>
            );
          }
          return row.samples.flatMap((sample, sampleIndex) => sample.files.map(({ file, result, status }, fileIndex) => {
            const selected = file.id === selectedFileId;
            return (
              <TableRow key={file.id} selected={selected} ref={selected ? selectedRowRef : undefined} data-testid="sequencing-check-file-row">
                {sampleIndex === 0 && fileIndex === 0 && sequenceCell}
                {fileIndex === 0 && (
                  <TableCell rowSpan={sample.files.length} sx={spanningCellSx} data-testid="sequencing-check-sample-cell">
                    {sample.sampleUid && <SampleUidLabel uid={sample.sampleUid} sx={sampleLabelSx} data-testid="sequencing-check-sample" />}
                  </TableCell>
                )}
                <TableCell align="center" padding="checkbox"><StatusIcon status={status} /></TableCell>
                <TableCell sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
                  <span data-testid="sequencing-check-file-name">{file.name}</span>
                </TableCell>
                <TableCell data-testid="sequencing-check-identity">{identityText(result)}</TableCell>
                <TableCell padding="none" align="center">
                  {onViewAlignment && (
                    <ViewAlignmentButton selected={selected} onClick={() => (selected ? onViewAlignment(null) : onViewAlignment(row.sequence, file))} />
                  )}
                </TableCell>
                <IssuesCell status={status} issues={fileIssues(result, status)} />
              </TableRow>
            );
          }));
        })}
      </TableBody>
    </Table>
  );
}
