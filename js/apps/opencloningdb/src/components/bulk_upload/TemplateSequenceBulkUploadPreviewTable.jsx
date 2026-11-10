import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { SEQUENCE_TYPE_LABELS } from '../../utils/query_utils';
import {
  getTemplateSequenceRowsInfo,
  templateSequenceRowIssues,
  templateSequenceRowStatus,
} from '../../utils/bulk_upload';
import { BulkUploadPreview, CommonTableRow } from '@opencloning/opencloningdb';

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

function TableComponent({ rows }) {
  return (
    <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
      <colgroup>
        <col style={{ width: '48px' }} />
        <col style={{ width: '35%' }} />
        <col style={{ width: '25%' }} />
        <col style={{ width: '40%' }} />
      </colgroup>
      <TableHead sx={{ textAlign: 'center' }}>
        <TableRow sx={{ textAlign: 'center' }}>
          <TableCell padding="checkbox"></TableCell>
          <TableCell>Name</TableCell>
          <TableCell>Sequence type</TableCell>
          <TableCell>Issues</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, index) => (
          <TemplateSequenceBulkUploadPreviewTableRow
            key={`${row.name}-${row.sequence_type}-${index}`}
            row={row}
          />
        ))}
      </TableBody>
    </Table>
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
