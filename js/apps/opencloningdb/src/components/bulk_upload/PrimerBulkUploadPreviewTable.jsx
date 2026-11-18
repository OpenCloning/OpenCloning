import React from 'react';
import { Box, TableCell } from '@mui/material';
import { getPrimerRowsInfo, primerRowStatus, rowIssues } from '../../utils/bulk_upload';
import { BulkUploadPreview, CommonTableRow, PreviewTable } from '@opencloning/opencloningdb';




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
            typography: 'sequence',
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

const COLUMNS = [
  { label: 'Name', width: '22%' },
  { label: 'UID', width: '12%' },
  { label: 'Sequence', width: '36%' },
  { label: 'Issues', width: '30%' },
];

function TableComponent({ rows }) {
  return (
    <PreviewTable columns={COLUMNS}>
      {rows.map((row, index) => (
        <PrimerBulkUploadPreviewTableRow key={`${row.name}-${row.sequence}-${index}`} row={row} />
      ))}
    </PreviewTable>
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
