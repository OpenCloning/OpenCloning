import { Alert } from '@mui/material';
import React from 'react';

function ServerErrorMessage({ serverError }) {
  return (
    <Alert severity="error">{serverError}</Alert>
  );
}

export default ServerErrorMessage;
