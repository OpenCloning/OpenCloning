import React from 'react';
import { Typography, TableContainer, Paper, Button, CircularProgress, Box, TableRow, TableCell, FormControl } from '@mui/material';
import TagMultiSelect from '../TagMultiSelect';
import { Cancel as CancelIcon, CheckCircle as CheckCircleIcon, Info as InfoIcon, Warning as WarningIcon } from '@mui/icons-material';


/** Scrollable container for the bulk tables, so that they fit in a BulkUploadModal. */
export function BulkTableContainer({ children }) {
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ mb: 2, maxHeight: '55vh', overflowY: 'auto', flex: 1, minHeight: 0 }}
    >
      {children}
    </TableContainer>
  );
}

/**
 * Wraps a bulk upload preview table with the summary and the import / cancel buttons.
 * The tag field is shown if onBulkTagsChange is passed, onTagCreateError receives the error if creating a tag fails.
 */
export function BulkUploadPreviewTableWrapper({
  rowsInfo,
  handleSubmit,
  handleCancel,
  isSubmitting,
  children,
  bulkTags = [],
  onBulkTagsChange,
  onTagCreateError,
  importMode = 'clearAndWarnings',
}) {
  const { clearRows, clearAndWarningRows, warningRowsCount, errorRowsCount, infoRowsCount = 0, orderedRows } = rowsInfo;
  const allClearRequired = importMode === 'allClearRequired';
  const canImportAll = clearRows.length === orderedRows.length && orderedRows.length > 0;
  const summaryText = allClearRequired
    ? `${clearRows.length} clear, ${errorRowsCount} error${infoRowsCount ? `, ${infoRowsCount} informational` : ''} out of ${orderedRows.length} uploaded items.`
    : `${clearRows.length} clear, ${warningRowsCount} warning, ${errorRowsCount} error${infoRowsCount ? `, ${infoRowsCount} informational` : ''} out of ${orderedRows.length} uploaded items.`;
  const orderingText = allClearRequired
    ? 'All rows must be clear to import. Errors are shown first.'
    : infoRowsCount > 0
      ? 'Errors are shown first, then warnings, informational rows, and clear rows.'
      : 'Errors are shown first, then warnings, then clear rows.';

  const clearButtonText = warningRowsCount === 0 ? 'Import' : 'Import entries without warnings';
  return (
    <>
      {onBulkTagsChange && (
        <FormControl fullWidth sx={{ mb: 2 }}>
          <TagMultiSelect
            label="Tags to apply (optional)"
            value={bulkTags}
            onChange={onBulkTagsChange}
            onCreateError={onTagCreateError}
            data-testid="bulk-upload-tags"
          />
        </FormControl>
      )}
      <Typography variant="body2" sx={{ mb: 2 }}>
        {orderingText}
      </Typography>

      <BulkTableContainer>
        {children}
      </BulkTableContainer>

      <Typography variant="body2" sx={{ mb: 2 }}>
        {summaryText}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button
          variant="outlined"
          color="error"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        {allClearRequired ? (
          <Button
            variant="contained"
            onClick={() => handleSubmit(orderedRows)}
            disabled={!canImportAll || isSubmitting}
            data-testid="bulk-upload-import-button"
          >
            {isSubmitting ? <CircularProgress size={24} /> : 'Import'}
          </Button>
        ) : (
          <>
            <Button
              variant="contained"
              onClick={() => handleSubmit(clearRows, 'clear')}
              disabled={clearRows.length < 1 || isSubmitting}
            >
              {isSubmitting ? <CircularProgress size={24} /> : clearButtonText}
            </Button>
            {warningRowsCount > 0 && (
              <Button
                variant="contained"
                color="warning"
                onClick={() => handleSubmit(clearAndWarningRows, 'with warnings')}
                disabled={clearAndWarningRows.length < 1 || isSubmitting}
              >
                {isSubmitting ? <CircularProgress size={24} /> : 'Import entries with warnings too'}
              </Button>
            )}
          </>
        )}
      </Box>
    </>
  );
}

export function StatusIcon({ status }) {
  if (!status) {
    return null;
  }
  const isClear = status === 'clear';
  const isError = status === 'error';
  const isInfo = status === 'info';
  const isPending = status === 'pending';

  return isPending ? (
    <CircularProgress size={20} data-testid="status-icon-pending" />
  ) : isClear ? (
    <CheckCircleIcon color="success" />
  ) : isError ? (
    <CancelIcon color="error" />
  ) : isInfo ? (
    <InfoIcon color="info" />
  ) : (
    <WarningIcon color="warning" />
  );
}


/** Table row with a status icon cell, the children cells and an issues cell. Other props are passed to the TableRow. */
export function CommonTableRow({ status, issues = [], children, ...rowProps }) {

  return (
    <TableRow {...rowProps}>
      <TableCell align="center" padding="checkbox">
        <StatusIcon status={status} />
      </TableCell>
      {children}
      <TableCell>
        {status !== 'clear' && (
          issues.map((issue) => (
            <div key={issue}>{issue}</div>
          ))
        )}
      </TableCell>
    </TableRow>
  );
}
