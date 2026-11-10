import React from 'react';
import { Alert, CircularProgress } from '@mui/material';
import RetryAlert from './RetryAlert';

export default function QueryStatusWrapper({
  children,
  queryResult,
  loadingMessage = 'Loading...',
  errorMessage = 'Could not load options',
  renderIfLoading = false,
}) {
  const { isError, isSuccess, refetch } = queryResult;
  if (isError) {
    return (
      <RetryAlert onRetry={refetch} sx={{ alignItems: 'center' }}>
        {errorMessage}
      </RetryAlert>
    );
  }
  if (!isSuccess && !renderIfLoading) {
    return (
      <Alert severity="info" icon={<CircularProgress color="inherit" size="1em" />}>
        {loadingMessage}
      </Alert>
    );
  }
  return children;
}
