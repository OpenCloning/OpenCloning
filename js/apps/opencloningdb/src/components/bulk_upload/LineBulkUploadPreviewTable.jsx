import React from 'react';
import { TableCell } from '@mui/material';
import {
  formatLineBulkList,
  getLineBulkRowsInfo,
  lineBulkRowIssues,
  lineBulkRowStatus,
} from '../../utils/bulk_upload';
import { BulkUploadPreview, CommonTableRow, PreviewTable } from '@opencloning/opencloningdb';

function LineBulkUploadPreviewTableRow({ row }) {
  const issues = lineBulkRowIssues(row);
  const status = lineBulkRowStatus(row);

  return (
    <CommonTableRow status={status} issues={issues}>
      <TableCell>{row.uid}</TableCell>
      <TableCell>{formatLineBulkList(row.genotype)}</TableCell>
      <TableCell>{formatLineBulkList(row.plasmids)}</TableCell>
      <TableCell>{formatLineBulkList(row.parent_uids)}</TableCell>
    </CommonTableRow>
  );
}

const COLUMNS = [
  { label: 'UID', width: '18%' },
  { label: 'Genotype', width: '22%' },
  { label: 'Plasmids', width: '22%' },
  { label: 'Parent UIDs', width: '18%' },
  { label: 'Issues', width: '20%' },
];

function TableComponent({ rows }) {
  return (
    <PreviewTable columns={COLUMNS}>
      {rows.map((row, index) => (
        <LineBulkUploadPreviewTableRow key={`${row.uid}-${index}`} row={row} />
      ))}
    </PreviewTable>
  );
}

export default function LineBulkUploadPreviewTable({
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
      getRowsInfo={getLineBulkRowsInfo}
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
