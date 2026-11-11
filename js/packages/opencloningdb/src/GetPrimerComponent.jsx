import React, { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import PrimerSelect from './PrimerSelect';
import { openCloningDBHttpClient } from './common';
import endpoints from './endpoints';
import { Box } from '@mui/material';

function GetPrimerComponent({ setPrimer, setError, existingDatabaseIds }) {
  const { mutate, reset } = useMutation({
    mutationFn: async (primerId) => {
      const response = await openCloningDBHttpClient.get(endpoints.primer(primerId));
      return response.data;
    },
    onSuccess: (primer) => {
      /* database_id matches API primer model */
      /* eslint-disable-next-line camelcase */
      setPrimer({ name: primer.name, sequence: primer.sequence, database_id: primer.id });
      setError('');
    },
    onError: (err) => {
      setError(err?.response?.data?.detail || err?.message || 'Could not retrieve primer from OpenCloningDB');
      setPrimer(null);
    },
  });

  const handlePrimerSelect = useCallback(async (selectedPrimer) => {
    if (selectedPrimer === null || selectedPrimer === '') {
      reset();
      setPrimer(null);
      setError('');
      return;
    }
    mutate(selectedPrimer.id);
  }, [mutate, reset, setPrimer, setError]);

  return (
    <Box sx={{ minWidth: '400px' }}>
      <PrimerSelect fullWidth setPrimer={handlePrimerSelect} filterDatabaseIds={existingDatabaseIds} />
    </Box>
  );
}

export default GetPrimerComponent;
