import React from 'react'
import { Box, SpeedDial, SpeedDialAction } from '@mui/material'
import { Build as BuildIcon, Sync as SyncIcon } from '@mui/icons-material'
import useDatabase from '../hooks/useDatabase';
import { useDispatch, useStore } from 'react-redux';
import { getSequencesNotInDatabase } from '@opencloning/utils/network';
import { cloningActions } from '@opencloning/store/cloning';
import useCloningAlerts from '../hooks/useCloningAlerts';
import { cloneDeep } from 'lodash-es';
import useBackendHttpClient from '../hooks/useBackendHttpClient';

const { setState: setCloningState } = cloningActions;


function useLocateSequencesInDatabaseAction() {
  const database = useDatabase();
  const store = useStore();
  const dispatch = useDispatch();
  const httpClient = useBackendHttpClient();
  const url = 'normalize_cloning_strategy';

  const { addAlert } = useCloningAlerts();
  const main = React.useCallback(async () => {
    const { sequences: seqState, sources: srcState, primers, description } = store.getState().cloning;
    let sequences = cloneDeep(seqState);
    let sources = cloneDeep(srcState);

    const sequencesNotInDb = getSequencesNotInDatabase(sources, sequences);
    if (sequencesNotInDb.length === 0) {
      addAlert({
        message: 'All sequences are already in the database',
        severity: 'success',
      });
      return;
    }
    const promises = sequencesNotInDb.map((sequence) => database.locateSequenceInDatabase(sequence));
    const results = await Promise.all(promises);
    if (!results.some((result) => result.length > 0)) {
      addAlert({
        message: 'No sequences located in database',
        severity: 'success',
      });
      return;
    }

    for (let i = 0; i < results.length; i++) {
      if (results[i].length === 0) {
        continue;
      }
      const localId = sequencesNotInDb[i].id;
      const newSequence = { ...results[i][0].sequence, id: localId };
      const newSource = { type: 'DatabaseSource', database_id: results[i][0].sequence_ref.id, input: [], id: localId };
      sources = sources.map((s) => s.id === localId ? newSource : s);
      sequences = sequences.map((s) => s.id === localId ? newSequence : s);
      addAlert({
        message: `Sequence ${localId} located in database`,
        severity: 'success',
      });
    }
    const { data: newCloningStrategy } = await httpClient.post(url, { sequences, sources, primers, description });
    dispatch(setCloningState(newCloningStrategy));

    // while (handledSequenceIds.size < sequences.length || iter < sequences.length) {
    //   iter++;
    //   const sequenceIdsThatAreInput = new Set(getSequenceIdsThatAreInput(sources));

    //   if (!sequenceIdsThatAreInput.includes(sequence.id)) {
    //     const newSource = {
    //       input: [],
    //       type: 'DatabaseSource',
    //       database_id: result[0].sequence_ref.id,
    //     };
    //     const newSequence = result[0].sequence
    //     batch(() => {
    //       dispatch(deleteSourceAndItsChildren(sequence.id));
    //       dispatch(addSourceAndItsOutputSequence({ source: newSource, sequence: newSequence }));
    //     });
    //   }
    //   console.log(result);
    // }
  }, [database, store, dispatch, addAlert, httpClient, url]);
  return main;
}
function CloningSpeedDial() {
  const database = useDatabase();
  const locateSequencesInDatabaseAction = useLocateSequencesInDatabaseAction();
  if (!database || !database.locateSequenceInDatabase) return null;
  return (
    // <Box sx={{ position: 'absolute', bottom: 0, right: 0 }}>
    <Box sx={{ position: 'fixed', bottom: 10, left: 10, zIndex: 1000 }} data-testid="cloning-speed-dial">
      <SpeedDial icon={<BuildIcon />} ariaLabel="Cloning tools" direction="up" >
        { database && Boolean(database.locateSequenceInDatabase) && <SpeedDialAction icon={<SyncIcon />} tooltipTitle="Synchronize sequences with database" onClick={locateSequencesInDatabaseAction} /> }
      </SpeedDial>

    </Box>
  // </Box>
  )
}

export default CloningSpeedDial
