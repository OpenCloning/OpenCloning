import React from 'react';
import { Alert, Box } from '@mui/material';
import { isEqual } from 'lodash-es';
import { useSelector } from 'react-redux';
import useAppAlerts from '../hooks/useAppAlerts';

function AppAlerts() {
  const { alerts } = useSelector((state) => state.opencloningdb, isEqual);
  const { removeAlert } = useAppAlerts();
  return (
    <Box className="app-alerts-container" style={{ position: 'absolute' }}>
      <Box id="opencloningdb-error-message-wrapper" sx={{ mt: 1, ml: 1}}>
        {alerts.map((alert, index) => (
          <Alert sx={{ mb: 1 }} key={index} severity={alert.severity} onClose={() => { removeAlert(alert.message); }}>
            {alert.message}
          </Alert>
        ))}
      </Box>
    </Box>
  );
}

export default AppAlerts;
