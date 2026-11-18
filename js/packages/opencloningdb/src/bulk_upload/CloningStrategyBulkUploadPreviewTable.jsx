import React from 'react';
import { TableCell } from '@mui/material';
import {
  cloningStrategyRowIssues,
  cloningStrategyRowStatus,
  getCloningStrategyRowsInfo,
} from './bulk_upload_utils';
import { CommonTableRow, PreviewTable } from './common';
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

const COLUMNS = [
  { label: 'File Name', width: '25%' },
  { label: 'Sync State', width: '17%' },
  { label: 'Sequences', width: '10%' },
  { label: 'Primers', width: '10%' },
  { label: 'Issues', width: '38%' },
];

function TableComponent({ rows }) {
  return (
    <PreviewTable columns={COLUMNS}>
      {rows.map((row, index) => (
        <CloningStrategyBulkUploadPreviewTableRow
          key={`${row.file_name || 'cloning-strategy'}-${index}`}
          row={row}
        />
      ))}
    </PreviewTable>
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
