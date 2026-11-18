import React from 'react';
import { TextField, Alert } from '@mui/material';
import FormDialog from '../common/FormDialog';

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
    <FormDialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      title={title}
      submitLabel="Save"
      submitButtonProps={{ variant: 'contained' }}
      onSubmit={() => onSave(tempValue)}
    >
      {maxLength && <Alert severity="info" sx={{ mb: 2 }}>Maximum input length is {maxLength} characters</Alert>}
      <TextField
        autoFocus
        multiline={multiline}
        rows={multiline ? 6 : undefined}
        fullWidth
        value={tempValue}
        onChange={handleChange}
        placeholder={placeholder}
        sx={{ mt: 1 }}
        slotProps={{
          htmlInput: maxLength ? { maxLength } : undefined
        }}
      />
    </FormDialog>
  );
}
