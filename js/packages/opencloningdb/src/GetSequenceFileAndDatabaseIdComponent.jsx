import React from 'react';
import { useMutation } from '@tanstack/react-query';
import SequenceSelect from './SequenceSelect';
import { openCloningDBHttpClient } from './common';
import endpoints from './endpoints';
import databaseSequenceToHistoryFile from './databaseSequenceToHistoryFile';
import { CircularProgress, FormControl } from '@mui/material';
import RetryAlert from '@opencloning/ui/components/form/RetryAlert';

function GetSequenceFileAndDatabaseIdComponent({ setFile, setDatabaseId }) {
  const lastSelectedSequenceRef = React.useRef(null);

  const { mutate, isPending, error, reset } = useMutation({
    mutationFn: async (selectedSequence) => {
      const selectedId = selectedSequence.id;
      const response = await openCloningDBHttpClient.get(endpoints.sequenceTextFile(selectedId));
      return {
        databaseId: selectedId,
        file: databaseSequenceToHistoryFile(response.data, selectedId),
      };
    },
    onSuccess: ({ file, databaseId }) => {
      setFile(file);
      setDatabaseId(databaseId);
    },
    onError: (requestError) => {
      console.error('Error fetching cloning strategy:', requestError);
    },
    retry: false,
  });

  const onSequenceSelect = React.useCallback((selectedSequence) => {
    if (!selectedSequence) {
      lastSelectedSequenceRef.current = null;
      reset();
      return;
    }

    lastSelectedSequenceRef.current = selectedSequence;
    mutate(selectedSequence);
  }, [mutate, reset]);

  const retryLoad = React.useCallback(() => {
    if (lastSelectedSequenceRef.current) {
      mutate(lastSelectedSequenceRef.current);
    }
  }, [mutate]);

  return (
    <FormControl fullWidth>
      <SequenceSelect multiple={false} label="Sequence" onChange={onSequenceSelect} />
      {isPending && <CircularProgress />}
      {error && <RetryAlert onRetry={retryLoad}>Failed to load sequence file.</RetryAlert>}
    </FormControl>
  );
}

export default GetSequenceFileAndDatabaseIdComponent;
