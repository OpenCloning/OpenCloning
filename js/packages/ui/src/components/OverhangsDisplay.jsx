import React from 'react';
import { Box } from '@mui/material';
import { formatSequenceForOverhangDisplay } from '@opencloning/utils/sequenceDisplay';

function OverhangsDisplay({ sequence, sequenceData }) {
  if (sequence === undefined
    || (sequence.overhang_crick_3prime === 0 && sequence.overhang_watson_3prime === 0)
  ) { return null; }
  const { watson, crick, middle } = formatSequenceForOverhangDisplay(
    sequenceData.sequence,
    sequence.overhang_crick_3prime,
    sequence.overhang_watson_3prime,
  );

  return (
    <Box
      className="overhang-representation"
      sx={{
        display: 'inline-block',
        mt: '10px',
        typography: 'sequence',
        fontSize: 'small',
        // Keep the spaces that align the strands
        whiteSpace: 'pre',
        maxWidth: 300,
        overflowX: 'auto',
      }}
    >
      {watson}
      <br />
      {middle}
      <br />
      {crick}
    </Box>
  );
}

export default OverhangsDisplay;
