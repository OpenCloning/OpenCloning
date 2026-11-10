import { CircularProgress } from '@mui/material';
import React from 'react';
import { eLabFTWHttpClient, readHeaders } from './common';
import RetryAlert from '@opencloning/ui/components/form/RetryAlert';
import { getFileFromELabFTW } from './utils';
import { encodePathSegment } from '@opencloning/utils/urlUtils';

function LoadHistoryComponent({ databaseId, loadDatabaseFile }) {
  const url = `/api/v2/items/${encodePathSegment(databaseId)}`;
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [retry, setRetry] = React.useState(0);
  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await eLabFTWHttpClient.get(url, { headers: readHeaders });
        const { uploads } = response.data;
        const historyFiles = uploads.filter((upload) => upload.real_name.endsWith('.json') && upload.comment.includes('OpenCloning'));
        if (historyFiles.length === 1) {
          const file = await getFileFromELabFTW(databaseId, historyFiles[0]);
          loadDatabaseFile(file, databaseId, true);
        } else if (historyFiles.length > 1) {
          setError('Multiple history files found for this ancestor sequence.');
        } else {
          setError('No history files found for this ancestor sequence.');
        }
        setLoading(false);
      } catch (e) {
        console.error(e);
        if (e.response?.status === 403) {
          setError('Ancestor sequence might have been deleted or you can no longer access it');
        } else {
          setError('Failed to load history file.');
        }
        setLoading(false);
      }
    };
    fetchData();
  }, [url, retry]);
  return (
    <div>
      {loading && <CircularProgress />}
      {error && <RetryAlert onRetry={() => setRetry((prev) => prev + 1)}>{error}</RetryAlert>}
    </div>
  );
}

export default LoadHistoryComponent;
