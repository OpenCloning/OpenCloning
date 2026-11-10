import React from 'react';
import { useDispatch, useStore } from 'react-redux';
import useCloningAlerts from '../../hooks/useCloningAlerts';
import { jsonToGenbank } from '@teselagen/bio-parsers';
import { cloningActions } from '@opencloning/store/cloning';
import useStoreEditor from '../../hooks/useStoreEditor';

const { updateSequence } = cloningActions;

export default function useUpdateAnnotationInMainSequence() {
  const store = useStore();
  const { addAlert } = useCloningAlerts();
  const dispatch = useDispatch();
  const { updateStoreEditor } = useStoreEditor();

  const updateFunction = React.useCallback(() => {
    const state = store.getState();
    const mainSequenceId = state.cloning.mainSequenceId;
    const currentSequenceData = state.cloning.teselaJsonCache[mainSequenceId];
    const newSequenceData = state.VectorEditor.mainEditor.sequenceData;
    const mainSequence = state.cloning.sequences.find((s) => s.id === mainSequenceId);
    const newSequence = { ...mainSequence, file_content: jsonToGenbank(newSequenceData) };
    if (currentSequenceData.sequence.toUpperCase() === newSequenceData.sequence.toUpperCase()) {
      addAlert({
        message: 'Annotation updated',
        severity: 'success',
      });
      dispatch(updateSequence(newSequence));
      // Clear the sequenceDataHistory
      updateStoreEditor('mainEditor', mainSequenceId, { sequenceDataHistory: {} });
    } else {
      addAlert({
        message: 'Sequences are different!',
        severity: 'error',
      });
    }
  }, [store, addAlert, dispatch, updateStoreEditor]);
  return updateFunction;
};
