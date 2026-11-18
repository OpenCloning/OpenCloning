
import React from 'react'
import { Button, CircularProgress } from '@mui/material'
import { useMutation } from '@tanstack/react-query';
import useCloningAlerts from '@opencloning/ui/hooks/useCloningAlerts';
import useLoadDatabaseFile from '@opencloning/ui/hooks/useLoadDatabaseFile';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import { useDispatch, useStore } from 'react-redux';
import { cloningActions } from '@opencloning/store/cloning';
import { getEmptyPlaceholderSource } from '@opencloning/store/cloning_utils';
import error2String from '@opencloning/utils/error2String';

const { addPrimer, deleteSourceAndItsChildren } = cloningActions;

function AddToCloningButton({ selectedEntities, children, entityType, disabled, ...rest }) {

  const { addAlert } = useCloningAlerts();
  const setHistoryFileError = (e) => addAlert({ message: e, severity: 'error' });
  const { loadDatabaseFile } = useLoadDatabaseFile({ source: null, sendSourceRequest: null, setHistoryFileError });
  const dispatch = useDispatch();
  const store = useStore();
  const handleAddEntity = async (seqId) => {
    try {
      if (entityType === 'sequence') {
        const { data: sequence } = await openCloningDBHttpClient.get(endpoints.sequenceTextFile(seqId));
        const source = { id: sequence.id, input: [], database_id: seqId, type: 'DatabaseSource' };
        const cloningStrategy = { sources: [source], sequences: [sequence], primers: [] };
        const file = new File([JSON.stringify(cloningStrategy)], 'cloning_strategy.json', { type: 'application/json' });
        await loadDatabaseFile(file, seqId);
      } else if (entityType === 'primer') {
        const { data: primer } = await openCloningDBHttpClient.get(endpoints.primer(seqId));
        dispatch(addPrimer({ name: primer.name, sequence: primer.sequence, database_id: seqId }));
      }
    } catch (error) {
      setHistoryFileError(error2String(error));
    }
  };
  const addEntities = async () => {
    const prevState = store.getState().cloning;
    const emptySource = getEmptyPlaceholderSource(prevState.sources)
    const promises = selectedEntities.filter((entity) => entity.type !== 'template_sequence').map((entity) => handleAddEntity(entity.id));
    await Promise.all(promises);
    if (entityType === 'sequence' && emptySource) {
      dispatch(deleteSourceAndItsChildren(emptySource.id));
    }
  };

  // Errors are reported per entity in handleAddEntity, so this never rejects
  const { mutate, isPending } = useMutation({ mutationFn: addEntities });

  if (selectedEntities.length < 1) {
    return null;
  }

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={() => mutate()}
      disabled={disabled || isPending}
      startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
      {...rest}
    >
      {children}
    </Button>
  )
}

export default AddToCloningButton
