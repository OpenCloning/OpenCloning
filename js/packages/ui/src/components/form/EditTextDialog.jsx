import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Alert } from '@mui/material';

export default function EditTextDialog({
  open,
  value,
  onClose,
  onSave,
  title = 'Edit',
  placeholder = 'Enter text...',
  multiline = false,
  maxLength,
}) {
  const [tempValue, setTempValue] = React.useState(value || '');

  React.useEffect(() => {
    if (open) setTempValue(value || '');
  }, [open, value]);

  const handleChange = (e) => {
    const newValue = multiline ? e.target.value.replace(/\n/g, '') : e.target.value;
    setTempValue(maxLength ? newValue.slice(0, maxLength) : newValue);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {maxLength && <Alert severity="info" sx={{ mb: 2 }}>Maximum input length is {maxLength} characters</Alert>}
        <TextField
          autoFocus
          multiline={multiline}
          rows={multiline ? 6 : undefined}
          fullWidth
          value={tempValue}
          onChange={handleChange}
          placeholder={placeholder}
          inputProps={maxLength ? { maxLength } : undefined}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(tempValue)} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}
