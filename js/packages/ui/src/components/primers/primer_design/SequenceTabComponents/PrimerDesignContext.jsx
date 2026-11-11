import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector, useStore } from 'react-redux';
import { updateEditor } from '@teselagen/ove';
import { isEqual } from 'lodash-es';
import { stringIsNotDNA } from '@opencloning/store/cloning_utils';
import useSpacers from './hooks/useSpacers';
import useTabNavigation from './hooks/useTabNavigation';
import useRegionSelection from './hooks/useRegionSelection';
import useSequenceProduct from './hooks/useSequenceProduct';
import useDesignPrimers from './hooks/useDesignPrimers';

const PrimerDesignContext = React.createContext();

export function PrimerDesignProvider({ children, designType, sequenceIds, primerDesignSettings, steps, isAmplified: isAmplifiedProp, circularAssembly = false }) {
  const isAmplified = useMemo(
    () => isAmplifiedProp || sequenceIds.map(() => true),
    [isAmplifiedProp, sequenceIds],
  );

  const templateSequenceIds = useMemo(() => {
    if (designType === 'homologous_recombination' || designType === 'gateway_bp') {
      return sequenceIds.slice(0, 1);
    }
    return sequenceIds;
  }, [sequenceIds, designType]);

  const initialFragmentOrientationsLength = templateSequenceIds.length;
  const initialSpacersLength = circularAssembly ? initialFragmentOrientationsLength : initialFragmentOrientationsLength + 1;

  const [fragmentOrientations, setFragmentOrientations] = useState(Array(initialFragmentOrientationsLength).fill('forward'));

  const store = useStore();
  const sequenceNames = useSelector((state) => sequenceIds.map((id) => state.cloning.teselaJsonCache[id].name), isEqual);
  const templateSequenceNames = useSelector((state) => templateSequenceIds.map((id) => state.cloning.teselaJsonCache[id].name), isEqual);

  const { spacers, setSpacers, spacersAreValid } = useSpacers({
    initialLength: initialSpacersLength,
  });

  const { selectedTab, onTabChange, handleNext, handleBack } = useTabNavigation({ sequenceIds });

  const { rois, handleSelectRegion } = useRegionSelection({
    sequenceCount: sequenceIds.length,
    handleNext,
  });

  const handleFragmentOrientationChange = useCallback((index, orientation) => {
    setFragmentOrientations((current) => current.map((v, i) => (i === index ? orientation : v)));
  }, []);

  const submissionPreventedMessage = useMemo(() => {
    if (rois.some((region, i) => region === null && isAmplified[i])) {
      return 'Not all regions have been selected';
    }
    if (primerDesignSettings.error) {
      return primerDesignSettings.error;
    }
    if (spacers.some((spacer) => stringIsNotDNA(spacer))) {
      return 'Spacer sequences not valid';
    }
    return '';
  }, [rois, isAmplified, primerDesignSettings.error, spacers]);

  const sequenceProduct = useSequenceProduct({
    rois, spacers, spacersAreValid, fragmentOrientations, circularAssembly,
    designType, primerDesignSettings, sequenceIds, submissionPreventedMessage,
  });

  // Sync the editor with the sequence product when on the settings tab
  useEffect(() => {
    if (selectedTab === sequenceIds.length) {
      const timeoutId = setTimeout(() => {
        updateEditor(store, 'mainEditor', { sequenceData: sequenceProduct || {}, selectionLayer: {} });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [sequenceProduct, selectedTab, sequenceIds.length, store]);

  const { primers, setPrimers, error, designPrimers, addPrimers } = useDesignPrimers({
    designType, sequenceIds, templateSequenceIds, isAmplified,
    rois, fragmentOrientations, spacers, circularAssembly, primerDesignSettings,
    handleNext, onTabChange,
  });

  const value = useMemo(() => ({
    primers,
    error,
    rois,
    designPrimers,
    setPrimers,
    selectedTab,
    onTabChange,
    handleNext,
    handleBack,
    handleSelectRegion,
    sequenceIds,
    fragmentOrientations,
    spacers,
    setFragmentOrientations,
    setSpacers,
    handleFragmentOrientationChange,
    sequenceNames,
    primerDesignSettings,
    submissionPreventedMessage,
    addPrimers,
    circularAssembly,
    templateSequenceIds,
    templateSequenceNames,
    designType,
    steps,
    isAmplified,
  }), [
    primers, error, rois, designPrimers, setPrimers,
    selectedTab, onTabChange, handleNext, handleBack, handleSelectRegion,
    sequenceIds, fragmentOrientations, circularAssembly, spacers,
    setFragmentOrientations, setSpacers, handleFragmentOrientationChange,
    sequenceNames, primerDesignSettings, submissionPreventedMessage,
    addPrimers, templateSequenceIds, templateSequenceNames,
    designType, steps, isAmplified,
  ]);

  return (
    <PrimerDesignContext.Provider value={value}>
      {children}
    </PrimerDesignContext.Provider>
  );
}

export const usePrimerDesign = () => React.useContext(PrimerDesignContext);
