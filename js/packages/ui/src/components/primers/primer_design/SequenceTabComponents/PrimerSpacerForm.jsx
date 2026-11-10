import React from 'react';
import { FormControl, TextField, Box } from '@mui/material';
import { stringIsNotDNA } from '@opencloning/store/cloning_utils';
import CollapsableLabel from './CollapsableLabel';
import { usePrimerDesign } from './PrimerDesignContext';
import { getSequenceLabel } from './utils/getSequenceLabel';

function PrimerSpacerForm({ open = true }) {
  const { spacers, setSpacers, circularAssembly, templateSequenceNames, templateSequenceIds, isAmplified } = usePrimerDesign();

  const fragmentCount = templateSequenceIds.length;

  const sequenceNamesWrapped = [...templateSequenceNames, templateSequenceNames[0]];
  const templateSequenceIdsWrapped = [...templateSequenceIds, templateSequenceIds[0]];

  const handleSpacerChange = (index, value) => {
    setSpacers((current) => current.map((spacer, i) => (i === index ? value : spacer)));
  };

  const getSequenceName = (seqIndex) => {
    const name = sequenceNamesWrapped[seqIndex];
    const id = templateSequenceIdsWrapped[seqIndex];
    return getSequenceLabel(id, name);
  };

  const getSpacerLabel = (index) => {
    if (index === 0 && !circularAssembly) {
      return `Before ${getSequenceName(index)}`;
    } if (index === fragmentCount && !circularAssembly) {
      return `After ${getSequenceName(fragmentCount - 1)}`;
    }
    if (circularAssembly) {
      return `Between ${getSequenceName(index)} and ${getSequenceName(index + 1)}`;
    }
    return `Between ${getSequenceName(index - 1)} and ${getSequenceName(index)}`;
  };

  return (
    <CollapsableLabel label="Spacer sequences" className="primer-spacer-form" open={open}>
      <Box sx={{ pt: 1, width: '80%', margin: 'auto' }}>
        <Box>
          {spacers.map((spacer, index) => {
            const error = stringIsNotDNA(spacer) ? 'Invalid DNA sequence' : '';
            const isFirstSpacerDisabled = !circularAssembly && index === 0 && !isAmplified[0];
            const isLastSpacerDisabled = !circularAssembly && index === fragmentCount && !isAmplified[fragmentCount - 1];
            const disabled = isFirstSpacerDisabled || isLastSpacerDisabled;
            return (
              <FormControl key={index} fullWidth sx={{ mb: 2 }}>
                <TextField
                  label={getSpacerLabel(index)}
                  value={spacer}
                  onChange={(e) => handleSpacerChange(index, e.target.value)}
                  variant="outlined"
                  size="small"
                  disabled={disabled}
                  inputProps={{
                    id: 'sequence',
                  }}
                  error={error !== ''}
                  helperText={disabled ? 'Not editable (adjacent fragment is not amplified)' : error}
                />
              </FormControl>
            );
          })}
        </Box>
      </Box>
    </CollapsableLabel>
  );
}

export default PrimerSpacerForm;
