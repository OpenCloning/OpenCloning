
import React from 'react'
import { Button } from '@mui/material'
import useCloningAlerts from '@opencloning/ui/hooks/useCloningAlerts';
import useLoadDatabaseFile from '@opencloning/ui/hooks/useLoadDatabaseFile';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import { useDispatch, useStore } from 'react-redux';
import { cloningActions } from '@opencloning/store/cloning';
import { getEmptyPlaceholderSource } from '@opencloning/store/cloning_utils';

const { addPrimer, deleteSourceAndItsChildren } = cloningActions;

function AddToCloningButton({ selectedEntities, children, entityType, ...rest }) {

  const { addAlert } = useCloningAlerts();
  const setHistoryFileError = (e) => addAlert({ message: e, severity: 'error' });
  const { loadDatabaseFile } = useLoadDatabaseFile({ source: null, sendSourceRequest: null, setHistoryFileError });
  const dispatch = useDispatch();
  const store = useStore();
  if (selectedEntities.length < 1) {
    return null;
  }
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
      setHistoryFileError(error?.response?.data?.detail || error?.message || 'Failed to add to design tab');
    }
  };
  const handleAddEntities = async () => {
    const prevState = store.getState().cloning;
    const emptySource = getEmptyPlaceholderSource(prevState.sources)
    const promises = selectedEntities.filter((entity) => entity.type !== 'template_sequence').map((entity) => handleAddEntity(entity.id));
    await Promise.all(promises);
    if (entityType === 'sequence' && emptySource) {
      dispatch(deleteSourceAndItsChildren(emptySource.id));
    }
  };

  return (
    <Button variant="contained" color="primary" onClick={handleAddEntities} {...rest}>
      {children}
    </Button>
  )
}

export default AddToCloningButton
