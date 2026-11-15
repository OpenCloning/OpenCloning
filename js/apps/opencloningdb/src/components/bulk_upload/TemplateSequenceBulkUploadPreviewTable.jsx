import React from 'react';
import { TableCell } from '@mui/material';
import { SEQUENCE_TYPE_LABELS } from '../../utils/query_utils';
import {
  getTemplateSequenceRowsInfo,
  templateSequenceRowIssues,
  templateSequenceRowStatus,
} from '../../utils/bulk_upload';
import { BulkUploadPreview, CommonTableRow, PreviewTable } from '@opencloning/opencloningdb';

function TemplateSequenceBulkUploadPreviewTableRow({ row }) {
  const issues = templateSequenceRowIssues(row);
  const status = templateSequenceRowStatus(row);
  const typeLabel = SEQUENCE_TYPE_LABELS[row.sequence_type] ?? row.sequence_type;

  return (
    <CommonTableRow status={status} issues={issues}>
      <TableCell>{row.name}</TableCell>
      <TableCell>{typeLabel}</TableCell>
    </CommonTableRow>
  );
}

const COLUMNS = [
  { label: 'Name', width: '35%' },
  { label: 'Sequence type', width: '25%' },
  { label: 'Issues', width: '40%' },
];

function TableComponent({ rows }) {
  return (
    <PreviewTable columns={COLUMNS}>
      {rows.map((row, index) => (
        <TemplateSequenceBulkUploadPreviewTableRow
          key={`${row.name}-${row.sequence_type}-${index}`}
          row={row}
        />
      ))}
    </PreviewTable>
  );
}

export default function TemplateSequenceBulkUploadPreviewTable({
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
      getRowsInfo={getTemplateSequenceRowsInfo}
      renderTable={(orderedRows) => <TableComponent rows={orderedRows} />}
      handleSubmit={handleSubmit}
      handleCancel={handleCancel}
      isSubmitting={isSubmitting}
      isValidating={isValidating}
      bulkTags={bulkTags}
      onBulkTagsChange={onBulkTagsChange}
      onTagCreateError={onTagCreateError}
      importMode="allClearRequired"
    />
  );
}
