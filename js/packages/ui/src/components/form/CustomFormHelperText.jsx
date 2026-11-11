import { FormHelperText } from '@mui/material';
import React from 'react';

function CustomFormHelperText({ children }) {
  return (
    <FormHelperText component="div" style={{ fontSize: 'x-small', marginLeft: 0, marginRight: 0, position: 'absolute', botom: '0px' }}>{children}</FormHelperText>
  );
}

export default CustomFormHelperText;
