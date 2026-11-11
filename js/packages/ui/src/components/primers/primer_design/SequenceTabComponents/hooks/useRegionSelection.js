import { useCallback, useState } from 'react';

function changeValueAtIndex(current, index, newValue) {
  return current.map((_, i) => (i === index ? newValue : current[i]));
}

export default function useRegionSelection({ sequenceCount, handleNext }) {
  const [rois, setRois] = useState(Array(sequenceCount).fill(null));

  const onSelectRegion = useCallback((index, selectedRegion, allowSinglePosition = false) => {
    const { caretPosition } = selectedRegion;
    if (caretPosition === undefined) {
      setRois((c) => changeValueAtIndex(c, index, null));
      return 'You have to select a region in the sequence editor!';
    }
    if (caretPosition === -1) {
      setRois((c) => changeValueAtIndex(c, index, selectedRegion));
      return '';
    }
    if (allowSinglePosition) {
      setRois((c) => changeValueAtIndex(c, index, selectedRegion));
      return '';
    }
    setRois((c) => changeValueAtIndex(c, index, null));
    return 'Select a region (not a single position) to amplify';
  }, []);

  const handleSelectRegion = useCallback((index, selectedRegion, allowSinglePosition = false) => {
    const regionError = onSelectRegion(index, selectedRegion, allowSinglePosition);
    if (!regionError) {
      handleNext();
    }
    return regionError;
  }, [onSelectRegion, handleNext]);

  return { rois, handleSelectRegion };
}
