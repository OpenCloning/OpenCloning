import { useDispatch } from 'react-redux';

export default function useAlerts({ actions }) {
  const dispatch = useDispatch();

  const addAlert = (alert) => {
    dispatch(actions.addAlert(alert));
  };

  const removeAlert = (message) => {
    dispatch(actions.removeAlert(message));
  };

  return { addAlert, removeAlert };
}
