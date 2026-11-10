import React from 'react';
import { Alert, Box, FormControl, FormLabel, InputAdornment, TextField } from '@mui/material';
import TabPanel from '../../../navigation/TabPanel';
import { usePrimerDesign } from './PrimerDesignContext';
import StepNavigation from './StepNavigation';
import { useSelector } from 'react-redux';
import EnzymeMultiSelect from '../../../form/EnzymeMultiSelect';
import { isEqual } from 'lodash-es';
import trimPadding from './utils/trimPadding';

function TabPanelEBICSettings() {
  const { error, selectedTab, sequenceIds, primers, submissionPreventedMessage, designPrimers, primerDesignSettings, rois } = usePrimerDesign();
  const { max_inside, max_outside, target_tm, target_tm_tolerance, updateSettings, restrictionSitesToAvoid, padding_left, padding_right } = primerDesignSettings;
  const [cutsitesInMarginsError, setCutsitesInMarginsError] = React.useState(false);

  const templateSequence = useSelector((state) => state.cloning.teselaJsonCache[sequenceIds[0]], isEqual);

  React.useEffect(() => {
    if (rois.length > 0 && rois[0] !== null) {
      const { padding_left: newPaddingLeft, padding_right: newPaddingRight, cutsitesInMargins } = trimPadding({
        templateSequence,
        padding_left,
        padding_right,
        restrictionSitesToAvoid,
        roi: rois[0],
        max_inside,
        max_outside,
      });
      updateSettings({ padding_left: newPaddingLeft, padding_right: newPaddingRight });
      setCutsitesInMarginsError(cutsitesInMargins);
    }
  }, [templateSequence, restrictionSitesToAvoid, rois, max_inside, max_outside, padding_left, padding_right]);

  return (
    <TabPanel value={selectedTab} index={sequenceIds.length}>
      <Box sx={{ width: '80%', margin: 'auto' }}>
        <Box sx={{ pt: 1 }}>
          <FormLabel>Primer settings</FormLabel>
          <Box sx={{ pt: 1.5 }}>

            <Box>
              <FormControl sx={{ mr: 2 }}>
                <TextField
                  label="Max inside"
                  value={max_inside}
                  onChange={(e) => { updateSettings({ max_inside: Number(e.target.value) }); }}
                  type="number"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">bp</InputAdornment>,
                    sx: { width: '10em' },
                  }}
                  error={max_inside < 0}
                  helperText={max_inside < 0 ? 'Max inside must be greater than 0' : ''}
                />
              </FormControl>

              <FormControl sx={{ mr: 2 }}>
                <TextField
                  label="Max outside"
                  value={max_outside}
                  onChange={(e) => { updateSettings({ max_outside: Number(e.target.value) }); }}
                  type="number"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">bp</InputAdornment>,
                    sx: { width: '10em' },
                  }}
                  error={max_outside < 0}
                  helperText={max_outside < 0 ? 'Max outside must be greater than 0' : ''}
                />
              </FormControl>
            </Box>

            <Box sx={{ mt: 2 }}>
              <FormControl sx={{ mr: 2 }}>
                <TextField
                  label="Target Tm"
                  value={target_tm}
                  onChange={(e) => { updateSettings({ target_tm: Number(e.target.value) }); }}
                  type="number"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                    sx: { width: '10em' },
                  }}
                />
              </FormControl>

              <FormControl sx={{ mr: 2 }}>
                <TextField
                  label="Tm tolerance"
                  value={target_tm_tolerance}
                  onChange={(e) => { updateSettings({ target_tm_tolerance: Number(e.target.value) }); }}
                  type="number"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                    sx: { width: '10em' },
                  }}
                />
              </FormControl>

            </Box>
            <Box sx={{ mt: 2 }}>
              <FormControl sx={{ mr: 2 }}>
                <TextField
                  label="Padding left"
                  value={padding_left}
                  onChange={(e) => { updateSettings({ padding_left: Number(e.target.value) }); }}
                  type="number"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">bp</InputAdornment>,
                    sx: { width: '10em' },
                  }}
                />
              </FormControl>
              <FormControl sx={{ mr: 2 }}>
                <TextField
                  label="Padding right"
                  value={padding_right}
                  onChange={(e) => { updateSettings({ padding_right: Number(e.target.value) }); }}
                  type="number"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">bp</InputAdornment>,
                    sx: { width: '10em' },
                  }}
                />
              </FormControl>
            </Box>
            <Box sx={{ mt: 2 }}>
              <FormControl sx={{ mr: 2, width: '15em' }}>
                <EnzymeMultiSelect
                  value={restrictionSitesToAvoid}
                  setEnzymes={(v) => updateSettings({ restrictionSitesToAvoid: v })}
                  label="Sites to avoid"
                  multiple={true}
                />
              </FormControl>

            </Box>
          </Box>
        </Box>
      </Box>
      {error && <Alert severity="error" sx={{ width: 'fit-content', margin: 'auto', mt: 2 }}>{error}</Alert>}
      {cutsitesInMarginsError && (
        <Alert severity="error" sx={{ width: 'fit-content', margin: 'auto', mt: 2 }}>
          Restriction enzyme cut sites were detected in the margin regions. Please adjust the margin size or select different restriction sites to avoid this issue.
        </Alert>
      )}
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

export default TabPanelEBICSettings;
