import { CircularProgress } from '@mui/material';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { openCloningDBHttpClient } from './common';
import RetryAlert from '@opencloning/ui/components/form/RetryAlert';
import endpoints from './endpoints';

function LoadHistoryComponent({ databaseId, loadDatabaseFile }) {
  const url = endpoints.sequenceCloningStrategy(databaseId);

  const { isLoading, error, data, refetch } = useQuery({
    queryKey: ['cloningStrategy', databaseId],
    queryFn: async () => {
      const response = await openCloningDBHttpClient.get(url);
      return response.data;
    },
    retry: false,
  });

  React.useEffect(() => {
    if (data) {
      const file = new File([JSON.stringify(data)], 'cloning_strategy.json', { type: 'application/json' });
      loadDatabaseFile(file, databaseId, true);
    }
  }, [data, databaseId, loadDatabaseFile]);

  return (
    <div>
      {isLoading && <CircularProgress />}
      {error && <RetryAlert onRetry={refetch}>Failed to load history file.</RetryAlert>}
    </div>
  );
}

export default LoadHistoryComponent;
