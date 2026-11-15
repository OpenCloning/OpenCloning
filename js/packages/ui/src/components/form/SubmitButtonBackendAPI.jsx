import { Alert, Button, CircularProgress } from '@mui/material';
import React from 'react';

function SubmitButtonBackendAPI({ requestStatus, children, sx = [], ...other }) {
  return (
    <>
      <Button fullWidth className="submit-backend-api" type="submit" variant="contained" sx={[{ height: '2.5em' }, ...(Array.isArray(sx) ? sx : [sx])]} {...other}>
        {requestStatus.status !== 'loading' ? children : (<CircularProgress className="loading-progress" color="inherit" size="2em" />)}
      </Button>
      {requestStatus.status === 'error' && (<Alert sx={{ marginTop: '10px' }} severity="error">{requestStatus.message}</Alert>)}
    </>
  );
}

export default SubmitButtonBackendAPI;
