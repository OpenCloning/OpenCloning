import { FormHelperText } from '@mui/material';
import React from 'react';

function CustomFormHelperText({ children }) {
  return (
    <FormHelperText component="div" sx={{ fontSize: 'x-small', mx: 0, position: 'absolute' }}>{children}</FormHelperText>
  );
}

export default CustomFormHelperText;
