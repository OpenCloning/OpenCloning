import React from 'react';
import { TableCell } from '@mui/material';
import { getSequenceRowsInfo, sequenceRowIssues, sequenceRowStatus } from '../../utils/bulk_upload';
import { BulkUploadPreview, CommonTableRow, PreviewTable } from '@opencloning/opencloningdb';

function SequenceBulkUploadPreviewTableRow({ row }) {
  const issues = sequenceRowIssues(row);
  const status = sequenceRowStatus(row);
  return (
    <CommonTableRow status={status} issues={issues}>
      <TableCell>{row.file_name || '—'}</TableCell>
      <TableCell>{row.name || '—'}</TableCell>
      <TableCell>{row.length ?? '—'}</TableCell>
      <TableCell>{typeof row.circular === 'boolean' ? (row.circular ? 'Yes' : 'No') : '—'}</TableCell>
    </CommonTableRow>
  );
}

const COLUMNS = [
  { label: 'File Name', width: '24%' },
  { label: 'Name', width: '24%' },
  { label: 'Length', width: '10%' },
  { label: 'Circular', width: '10%' },
  { label: 'Warnings', width: '32%' },
];

function TableComponent({ rows }) {
  return (
    <PreviewTable columns={COLUMNS}>
      {rows.map((row, index) => (
        <SequenceBulkUploadPreviewTableRow key={`${row.file_name}-${row.seguid}-${index}`} row={row} />
      ))}
    </PreviewTable>
  );
}

export default function SequenceBulkUploadPreviewTable({
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
      getRowsInfo={getSequenceRowsInfo}
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
