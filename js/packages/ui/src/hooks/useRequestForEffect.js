import React from 'react'

function useRequestForEffect({ requestFunction, onSuccess }) {
  const [requestStatus, setRequestStatus] = React.useState({ status: 'loading', message: '' });
  const [connectAttempt, setConnectAttempt] = React.useState(0);

  const retry = React.useCallback(() => {
    setConnectAttempt((prev) => prev + 1);
  }, []);

  React.useEffect(() => {
    const fetchData = async () => {
      setRequestStatus({ status: 'loading', message: '' });
      try {
        const resp = await requestFunction();
        setRequestStatus({ status: 'success', message: '' });
        onSuccess(resp);
      } catch (error) {
        setRequestStatus({ status: 'error', message: error.message });
      }
    };
    fetchData();
  }, [connectAttempt, requestFunction, onSuccess]);

  return React.useMemo(() => ({ requestStatus, retry }), [requestStatus, retry]);
}

export default useRequestForEffect
