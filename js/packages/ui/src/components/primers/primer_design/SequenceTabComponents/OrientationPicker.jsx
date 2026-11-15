import { Box, FormControlLabel, FormLabel, Radio, RadioGroup } from '@mui/material';
import React from 'react';
import { usePrimerDesign } from './PrimerDesignContext';
import { getSequenceLabel } from './utils/getSequenceLabel';

function OrientationPicker({ id, index }) {
  const { designType, fragmentOrientations, handleFragmentOrientationChange, templateSequenceNames } = usePrimerDesign();
  const sequenceName = templateSequenceNames[index];
  let label = getSequenceLabel(id, sequenceName);
  if (designType === 'homologous_recombination') {
    label = 'Orientation of insert';
  }
  return (
    // The label on the right of 40% of the width, the radio buttons on the left of the rest
    <Box className="orientation-picker" sx={{ display: 'grid', gridTemplateColumns: '2fr 3fr', alignItems: 'center', columnGap: 1, py: 0.25 }}>
      <FormLabel id={`fragment-orientation-label-${index}`} sx={{ textAlign: 'right' }}>{label}</FormLabel>
      <RadioGroup
        row
        aria-labelledby={`fragment-orientation-label-${index}`}
        name={`fragment-orientation-${index}`}
        value={fragmentOrientations[index]}
        onChange={(e) => handleFragmentOrientationChange(index, e.target.value)}
      >
        <FormControlLabel value="forward" control={<Radio />} label="Forward" />
        <FormControlLabel value="reverse" control={<Radio />} label="Reverse" />
      </RadioGroup>
    </Box>
  );
}

export default OrientationPicker;
