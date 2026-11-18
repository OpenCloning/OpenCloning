import React from 'react';
import { TextField } from '@mui/material';
import { filterFieldSx } from './urlParamsForm';

function SearchBarTextField({ label, placeholder, value, onChange, sx }) {
  return (
    <TextField
      size="small"
      variant="outlined"
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      sx={{ ...filterFieldSx, ...sx }}
    />
  );
}

export default SearchBarTextField;
