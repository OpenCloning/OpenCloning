import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { BulkUploadPreviewTableWrapper } from './common';

export default function BulkUploadPreview({
  rows,
  getRowsInfo,
  renderTable,
  handleSubmit,
  handleCancel,
  isSubmitting,
  isValidating,
  bulkTags,
  onBulkTagsChange,
  onTagCreateError,
  importMode,
}) {
  if (isValidating) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const rowsInfo = getRowsInfo(rows);
  return (
    <BulkUploadPreviewTableWrapper
      rowsInfo={rowsInfo}
      handleSubmit={handleSubmit}
      handleCancel={handleCancel}
      isSubmitting={isSubmitting}
      bulkTags={bulkTags}
      onBulkTagsChange={onBulkTagsChange}
      onTagCreateError={onTagCreateError}
      importMode={importMode}
    >
      {renderTable(rowsInfo.orderedRows)}
    </BulkUploadPreviewTableWrapper>
  );
}