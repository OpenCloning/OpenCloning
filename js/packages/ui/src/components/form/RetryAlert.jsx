import React from 'react';
import { Alert, Button } from '@mui/material';

function RetryAlert({ onRetry, children, ...props }) {
  return (
    <Alert
      severity="error"
      action={(
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
      )}
      {...props}
    >
      {children}
    </Alert>
  );
}

export default RetryAlert;
