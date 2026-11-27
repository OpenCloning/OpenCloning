import React from 'react';
import { Alert, Box, Button, FormControl, IconButton } from '@mui/material';
import { AddCircle as AddCircleIcon, Delete as DeleteIcon } from '@mui/icons-material';

/**
 * Form to create several entities with new UIDs, one row each (rows from useUidRows). UidField is the field that
 * validates a new UID (e.g. NewSampleUID), renderExtraFields(row) gives other fields of a row. onSubmit is called
 * when all the UIDs are valid and different.
 */
export default function UidRowsForm({ uidRows, UidField, uidLabel, renderExtraFields, onSubmit, submitting, submitText }) {
  const { rows, updateRow, addRow, removeRow, duplicates, ready } = uidRows;
  const canSubmit = ready && !submitting;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (canSubmit) onSubmit();
  };

  return (
    <form onSubmit={handleSubmit}>
      {rows.map((row, index) => (
        <Box key={row.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <FormControl fullWidth>
            <UidField
              label={`${uidLabel} ${index + 1}`}
              onChange={(uid) => updateRow(row.id, { uid })}
              onValidationStateChange={({ isChecking }) => updateRow(row.id, { checking: isChecking })}
            />
          </FormControl>
          {renderExtraFields?.(row)}
          {rows.length > 1 && (
            <IconButton onClick={() => removeRow(row.id)} size="small" sx={{ mb: 3 }} aria-label="Remove UID">
              <DeleteIcon />
            </IconButton>
          )}
        </Box>
      ))}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
        <Button onClick={addRow} color="success" startIcon={<AddCircleIcon />}>
          Add another UID
        </Button>
      </Box>
      {duplicates.length > 0 && (
        <Alert severity="error" sx={{ mt: 1 }}>Duplicate UIDs: {duplicates.join(', ')}</Alert>
      )}
      <FormControl fullWidth sx={{ mt: 2 }}>
        <Button type="submit" variant="contained" disabled={!canSubmit}>
          {submitting ? 'Creating…' : submitText}
        </Button>
      </FormControl>
    </form>
  );
}
