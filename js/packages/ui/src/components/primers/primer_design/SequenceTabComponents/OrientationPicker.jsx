import { FormControlLabel, FormLabel, Radio, RadioGroup } from '@mui/material';
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
    <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', margin: '0', padding: '0' }}>
      <tbody>
        <tr style={{ border: 'none' }}>
          <td style={{ width: '40%', verticalAlign: 'middle', textAlign: 'right', paddingRight: '8px', border: 'none', padding: '2px 8px 2px 0' }}>
            <FormLabel id={`fragment-orientation-label-${index}`}>{label}</FormLabel>
          </td>
          <td style={{ width: '60%', verticalAlign: 'middle', textAlign: 'left', border: 'none', padding: '2px 0' }}>
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
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export default OrientationPicker;
