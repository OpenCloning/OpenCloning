import { useCallback } from 'react';
import { batch, useDispatch } from 'react-redux';
import { cloningActions } from '@opencloning/store/cloning';
import useStoreEditor from '../../../../hooks/useStoreEditor';

const { setMainSequenceId, setCurrentTab } = cloningActions;

export default function useNavigateAfterPrimerDesign() {
  const dispatch = useDispatch();
  const { updateStoreEditor } = useStoreEditor();

  return useCallback((primaryAction, inputSequenceId) => {
    batch(() => {
      primaryAction();
      dispatch(setMainSequenceId(inputSequenceId));
      updateStoreEditor('mainEditor', inputSequenceId);
      dispatch(setCurrentTab(3));
      setTimeout(() => {
        document.querySelector('.tab-panels-container')?.scrollTo({ top: 0, behavior: 'instant' });
      }, 300);
    });
  }, [dispatch, updateStoreEditor]);
}
