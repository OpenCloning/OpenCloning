import { Alert, Box } from '@mui/material';
import { isEqual } from 'lodash-es';
import React from 'react';
import { useSelector } from 'react-redux';
import ExternalServicesStatusCheck from './ExternalServicesStatusCheck';

function AppAlerts( { reducerName, removeAlert } ) {
  const { alerts } = useSelector((state) => state[reducerName], isEqual);
  return (
    <Box className="app-alerts-container" sx={{ position: 'absolute' }}>
      <Box
        id="global-error-message-wrapper"
        // Long strings break only when necessary
        sx={{ position: 'relative', top: 0, zIndex: 999, maxWidth: '25em', '& > div': { ml: '10px', mb: '10px', wordBreak: 'break-word' } }}
      >
        {alerts.map((alert, index) => (<Alert key={index} severity={alert.severity} onClose={() => { removeAlert(alert.message); }}>{alert.message}</Alert>))}
        <ExternalServicesStatusCheck />
      </Box>
    </Box>
  );
}

export default AppAlerts;
