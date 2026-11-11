import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import {
  cloningStrategyRowIssues,
  cloningStrategyRowStatus,
  getCloningStrategyRowsInfo,
} from './bulk_upload_utils';
import { CommonTableRow } from './common';
import BulkUploadPreview from './BulkUploadPreview';

function statusLabel(status) {
  if (status === 'error') {
    return 'Invalid';
  }
  if (status === 'warning') {
    return 'Review warnings';
  }
  if (status === 'info') {
    return 'Already synced';
  }
  return 'Ready to import';
}

function strategyCounts(row) {
  return {
    sequenceCount: row.cloning_strategy?.sequences?.length ?? 0,
    primerCount: row.cloning_strategy?.primers?.length ?? 0,
  };
}

function CloningStrategyBulkUploadPreviewTableRow({ row }) {
  const issues = cloningStrategyRowIssues(row);
  const status = cloningStrategyRowStatus(row);
  const { sequenceCount, primerCount } = strategyCounts(row);

  return (
    <CommonTableRow status={status} issues={issues}>
      <TableCell>{row.file_name || '—'}</TableCell>
      <TableCell>{statusLabel(status)}</TableCell>
      <TableCell>{sequenceCount}</TableCell>
      <TableCell>{primerCount}</TableCell>
    </CommonTableRow>
  );
}

function TableComponent({ rows }) {
  return (
    <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
      <colgroup>
        <col style={{ width: '48px' }} />
        <col style={{ width: '25%' }} />
        <col style={{ width: '17%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '38%' }} />
      </colgroup>
      <TableHead sx={{ textAlign: 'center' }}>
        <TableRow sx={{ textAlign: 'center' }}>
          <TableCell padding="checkbox"></TableCell>
          <TableCell>File Name</TableCell>
          <TableCell>Sync State</TableCell>
          <TableCell>Sequences</TableCell>
          <TableCell>Primers</TableCell>
          <TableCell>Issues</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, index) => (
          <CloningStrategyBulkUploadPreviewTableRow
            key={`${row.file_name || 'cloning-strategy'}-${index}`}
            row={row}
          />
        ))}
      </TableBody>
    </Table>
  );
}

export default function CloningStrategyBulkUploadPreviewTable({
  rows,
  handleSubmit,
  handleCancel,
  isSubmitting,
  isValidating,
  bulkTags,
  onBulkTagsChange,
  onTagCreateError,
}) {
  return (
    <BulkUploadPreview
      rows={rows}
      getRowsInfo={getCloningStrategyRowsInfo}
      renderTable={(orderedRows) => <TableComponent rows={orderedRows} />}
      handleSubmit={handleSubmit}
      handleCancel={handleCancel}
      isSubmitting={isSubmitting}
      isValidating={isValidating}
      bulkTags={bulkTags}
      onBulkTagsChange={onBulkTagsChange}
      onTagCreateError={onTagCreateError}
    />
  );
}
