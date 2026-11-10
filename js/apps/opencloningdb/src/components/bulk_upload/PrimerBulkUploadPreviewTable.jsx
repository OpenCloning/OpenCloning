import React from 'react';
import { Box, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { getPrimerRowsInfo, primerRowStatus, rowIssues } from '../../utils/bulk_upload';
import { BulkUploadPreview, CommonTableRow } from '@opencloning/opencloningdb';




function PrimerBulkUploadPreviewTableRow({ row }) {
  const issues = rowIssues(row);
  const status = primerRowStatus(row);
  return (
    <CommonTableRow status={status} issues={issues}>
      <TableCell>{row.name}</TableCell>
      <TableCell>{row.uid || '—'}</TableCell>
      <TableCell sx={{ maxWidth: 300 }}>
        <Box
          sx={{
            fontFamily: 'monospace',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            maxWidth: 300,
            pb: 0.25,
          }}
        >
          {row.sequence}
        </Box>
      </TableCell>
    </CommonTableRow>
  );
}

function TableComponent({ rows }) {
  return (
    <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
      <colgroup>
        <col style={{ width: '48px' }} />
        <col style={{ width: '22%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '36%' }} />
        <col style={{ width: '30%' }} />
      </colgroup>
      <TableHead sx={{ textAlign: 'center' }}>
        <TableRow sx={{ textAlign: 'center' }}>
          <TableCell padding="checkbox"></TableCell>
          <TableCell>Name</TableCell>
          <TableCell>UID</TableCell>
          <TableCell>Sequence</TableCell>
          <TableCell>Issues</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, index) => (
          <PrimerBulkUploadPreviewTableRow key={`${row.name}-${row.sequence}-${index}`} row={row} />
        ))}
      </TableBody>
    </Table>
  );
}

export default function PrimerBulkUploadPreviewTable({
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
      getRowsInfo={getPrimerRowsInfo}
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
