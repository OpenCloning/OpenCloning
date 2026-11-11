import React from 'react';
import RetryAlert from './RetryAlert';

function RequestStatusWrapper({ children, requestStatus, retry }) {
  if (requestStatus.status === 'success') {
    return children;
  }
  if (requestStatus.status === 'loading') {
    return <div>Loading...</div>;
  }
  if (requestStatus.status === 'error') {
    return <RetryAlert onRetry={retry} sx={{ margin: 'auto', width: '80%', my: 2 }}>{requestStatus.message}</RetryAlert>;
  }
  return null;
}

export default RequestStatusWrapper;
