import React from 'react';
import { TextField } from '@mui/material';

function SearchBarTextField({ label, placeholder, value, onChange, sx }) {
  return (
    <TextField
      size="small"
      variant="outlined"
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      sx={sx}
    />
  );
}

export default SearchBarTextField;

