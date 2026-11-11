import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import useStoreEditor from '../../../../../hooks/useStoreEditor';
import { cloningActions } from '@opencloning/store/cloning';

const { setMainSequenceId } = cloningActions;

export default function useTabNavigation({ sequenceIds }) {
  const [selectedTab, setSelectedTab] = useState(0);
  const dispatch = useDispatch();
  const { updateStoreEditor } = useStoreEditor();
  const mainSequenceId = useSelector((state) => state.cloning.mainSequenceId);

  const onTabChange = useCallback((event, newValue) => {
    setSelectedTab(newValue);
    if (newValue < sequenceIds.length) {
      updateStoreEditor('mainEditor', sequenceIds[newValue]);
      dispatch(setMainSequenceId(sequenceIds[newValue]));
    } else if (newValue !== sequenceIds.length) {
      updateStoreEditor('mainEditor', null);
    }
  }, [sequenceIds, updateStoreEditor, dispatch]);

  const handleNext = useCallback(() => {
    onTabChange(null, selectedTab + 1);
  }, [onTabChange, selectedTab]);

  const handleBack = useCallback(() => {
    onTabChange(null, selectedTab - 1);
  }, [onTabChange, selectedTab]);

  useEffect(() => {
    const mainSequenceIndex = sequenceIds.indexOf(mainSequenceId);
    if (mainSequenceIndex !== -1) {
      setSelectedTab(mainSequenceIndex);
    }
  }, [sequenceIds, mainSequenceId]);

  return { selectedTab, onTabChange, handleNext, handleBack };
}
