import React from 'react'
import ServerStaticFileSelect from '../form/ServerStaticFileSelect';
import { Alert, LinearProgress } from '@mui/material';

function SourceServerStaticFile({ source, requestStatus, sendSourceRequest }) {
  const onFileSelected = React.useCallback((file) => {
    const requestData = new FormData();
    requestData.append('file', file);
    const config = {
      headers: {
        'content-type': 'multipart/form-data',
      },
    };
    sendSourceRequest({ endpoint: 'read_from_file', requestData, config, source });
  }, [sendSourceRequest, source]);

  return (
    <>
      <ServerStaticFileSelect onFileSelected={onFileSelected} />
      { requestStatus.status === 'loading' && <LinearProgress /> }
      { requestStatus.status === 'error' && <Alert severity="error">{requestStatus.message}</Alert> }
    </>
  );
}

export default SourceServerStaticFile
