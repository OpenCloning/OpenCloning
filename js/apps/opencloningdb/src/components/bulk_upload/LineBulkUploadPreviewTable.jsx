import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import {
  formatLineBulkList,
  getLineBulkRowsInfo,
  lineBulkRowIssues,
  lineBulkRowStatus,
} from '../../utils/bulk_upload';
import { BulkUploadPreview, CommonTableRow } from '@opencloning/opencloningdb';

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

function TableComponent({ rows }) {
  return (
    <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
      <colgroup>
        <col style={{ width: '48px' }} />
        <col style={{ width: '18%' }} />
        <col style={{ width: '22%' }} />
        <col style={{ width: '22%' }} />
        <col style={{ width: '18%' }} />
        <col style={{ width: '20%' }} />
      </colgroup>
      <TableHead sx={{ textAlign: 'center' }}>
        <TableRow sx={{ textAlign: 'center' }}>
          <TableCell padding="checkbox"></TableCell>
          <TableCell>UID</TableCell>
          <TableCell>Genotype</TableCell>
          <TableCell>Plasmids</TableCell>
          <TableCell>Parent UIDs</TableCell>
          <TableCell>Issues</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, index) => (
          <LineBulkUploadPreviewTableRow key={`${row.uid}-${index}`} row={row} />
        ))}
      </TableBody>
    </Table>
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
