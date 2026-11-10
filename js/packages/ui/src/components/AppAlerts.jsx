import { Alert } from '@mui/material';
import { isEqual } from 'lodash-es';
import React from 'react';
import { useSelector } from 'react-redux';
import ExternalServicesStatusCheck from './ExternalServicesStatusCheck';

function AppAlerts( { reducerName, removeAlert } ) {
  const { alerts } = useSelector((state) => state[reducerName], isEqual);
  return (
    <div className="app-alerts-container" style={{ position: 'absolute' }}>
      <div id="global-error-message-wrapper">
        {alerts.map((alert, index) => (<Alert key={index} severity={alert.severity} onClose={() => { removeAlert(alert.message); }}>{alert.message}</Alert>))}
        <ExternalServicesStatusCheck />
      </div>
    </div>
  );
}

export default AppAlerts;
