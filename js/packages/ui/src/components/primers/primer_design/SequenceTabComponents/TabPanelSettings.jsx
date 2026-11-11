import React from 'react';
import { Alert, Box, FormLabel } from '@mui/material';
import StepNavigation from './StepNavigation';
import TabPanel from '../../../navigation/TabPanel';
import PrimerSettingsForm from './PrimerSettingsForm';
import PrimerSpacerForm from './PrimerSpacerForm';
import OrientationPicker from './OrientationPicker';
import { usePrimerDesign } from './PrimerDesignContext';
import RestrictionSpacerForm from './RestrictionSpacerForm';

function TabPanelSettings() {
  const { error, templateSequenceIds, designType, selectedTab, sequenceIds, designPrimers, primers, primerDesignSettings, submissionPreventedMessage } = usePrimerDesign();
  return (
    <TabPanel value={selectedTab} index={sequenceIds.length}>
      <Box sx={{ width: '80%', margin: 'auto' }}>
        <PrimerSettingsForm {...primerDesignSettings} />
        <Box sx={{ mt: 2 }}>
          {designType === 'gibson_assembly' && <FormLabel>Fragment orientation</FormLabel>}
          {templateSequenceIds.map((id, index) => (
            <OrientationPicker
              key={id}
              id={id}
              index={index}
            />
          ))}
        </Box>
        {designType === 'restriction_ligation' && <RestrictionSpacerForm />}
        <PrimerSpacerForm />

      </Box>
      {error && (<Alert severity="error" sx={{ width: 'fit-content', margin: 'auto', mb: 2 }}>{error}</Alert>)}
      <StepNavigation
        onStepCompletion={designPrimers}
        stepCompletionText="Design primers"
        nextDisabled={primers.length === 0}
        stepCompletionToolTip={submissionPreventedMessage}
        allowStepCompletion={submissionPreventedMessage === ''}
      />
    </TabPanel>
  );
}

export default TabPanelSettings;
