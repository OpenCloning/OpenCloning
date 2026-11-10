import { useDispatch } from 'react-redux';
import error2String from '@opencloning/utils/error2String';
import { appActions } from '../store/appReducer';

export default function useAppAlerts() {
  const dispatch = useDispatch();

  const addAlert = (alert) => {
    const newAlert = { ...alert };
    if (typeof newAlert.message !== 'string') {
      newAlert.message = JSON.stringify(newAlert.message);
    }
    dispatch(appActions.addAlert(newAlert));
  };

  // Shows the message of an error (e.g. from a failed request)
  const addErrorAlert = (error) => {
    addAlert({ message: error2String(error) || 'Unknown error', severity: 'error' });
  };

  const removeAlert = (message) => {
    dispatch(appActions.removeAlert(message));
  };

  return { addAlert, addErrorAlert, removeAlert };
}
