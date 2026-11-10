import React from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { Box } from '@mui/material';
import TabPanel from '../../../navigation/TabPanel';
import { usePrimerDesign } from './PrimerDesignContext';
import StepNavigation from './StepNavigation';
import PrimerResultForm from './PrimerResultForm';

function TabPanelResults() {
  const { selectedTab, primers: allPrimers, addPrimers, setPrimers, sequenceIds } = usePrimerDesign();
  const primers = React.useMemo(() => allPrimers.filter((primer) => primer !== null), [allPrimers]);
  const existingPrimerNames = useSelector((state) => state.cloning.primers.map((p) => p.name), shallowEqual);
  const primersAreValid = primers.length && primers.every((primer) => primer.name && !existingPrimerNames.includes(primer.name));
  return (
    <TabPanel value={selectedTab} index={sequenceIds.length + 1}>
      <Box sx={{ marginTop: 3 }}>
        {primers.map((primer, index) => (
          <PrimerResultForm
            key={index}
            updatePrimerName={(newName) => {
              const updatedPrimers = [...primers];
              updatedPrimers[index] = { ...primer, name: newName };
              setPrimers(updatedPrimers);
            }}
            primer={primer}
            existingPrimerNames={existingPrimerNames}
          />
        ))}
        <StepNavigation
          onStepCompletion={addPrimers}
          stepCompletionText="Save primers"
          nextDisabled
          stepCompletionToolTip="Primers are not valid"
          allowStepCompletion={primersAreValid}
        />
      </Box>
    </TabPanel>
  );
}

export default TabPanelResults;
