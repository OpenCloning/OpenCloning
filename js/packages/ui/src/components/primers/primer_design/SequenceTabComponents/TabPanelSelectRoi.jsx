import React from 'react';
import { Alert, FormControl, TextField } from '@mui/material';
import { useSelector, useStore } from 'react-redux';

import StepNavigation from './StepNavigation';
import { selectedRegion2String } from '@opencloning/utils/selectedRegionUtils';
import GatewayRoiSelect from './GatewayRoiSelect';
import TabPanel from '../../../navigation/TabPanel';
import { usePrimerDesign } from './PrimerDesignContext';

function TabPanelSelectRoi({ step, index }) {
  const { selectedTab, rois, handleSelectRegion, handleNext, sequenceIds, primerDesignSettings, designType, isAmplified } = usePrimerDesign();
  const [error, setError] = React.useState('');
  const editorHasSelection = useSelector((state) => state.cloning.mainSequenceSelection.caretPosition !== undefined);
  const store = useStore();
  const id = sequenceIds[index];
  const {
    description = `Select the fragment of sequence ${id} to be amplified in the editor and click "Choose region"`,
    inputLabel = `Amplified region (sequence ${id})`,
    allowSinglePosition = false,
    stepCompletionToolTip = 'Select a region in the editor',
  } = step;

  const notAmplified = !isAmplified[index];

  const mode = designType === 'gateway_bp' && index === 1 ? 'gateway_bp' : 'editor';
  const allowStepCompletion = notAmplified || (mode === 'editor' && editorHasSelection) || (mode === 'gateway_bp' && primerDesignSettings.knownCombination);
  const onStepCompletion = () => {
    if (notAmplified) {
      handleNext();
      return;
    }
    const selectedRegion = store.getState().cloning.mainSequenceSelection;
    setError(handleSelectRegion(index, selectedRegion, allowSinglePosition));
  };

  const allRequiredRoisSelected = rois.every((region, i) => region !== null || !isAmplified[i]);

  return (
    <TabPanel value={selectedTab} index={index} className={`select-roi-tab-${index}`}>
      {notAmplified
        ? <Alert severity="info">The whole sequence will be used (not amplified by PCR). You can set orientation in the settings step.</Alert>
        : <Alert severity="info">{description}</Alert>}
      {error && (<Alert severity="error">{error}</Alert>)}
      {!notAmplified && mode === 'editor' && (
      <FormControl sx={{ py: 2 }}>
        <TextField
          label={inputLabel}
          value={selectedRegion2String(rois[index])}
          disabled
        />
      </FormControl>
      )}
      {!notAmplified && mode === 'gateway_bp' && (
        <GatewayRoiSelect id={id} />
      )}
      <StepNavigation
        isFirstStep={index === 0}
        nextDisabled={(index === sequenceIds.length - 1) && !allRequiredRoisSelected}
        nextToolTip="You must select all regions before proceeding"
        allowStepCompletion={allowStepCompletion}
        stepCompletionText={notAmplified ? 'Next' : 'Choose region'}
        stepCompletionToolTip={notAmplified ? '' : stepCompletionToolTip}
        onStepCompletion={onStepCompletion}
      />

    </TabPanel>
  );
}

export default TabPanelSelectRoi;
