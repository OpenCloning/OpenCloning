import React from 'react';
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
    <div className="overhang-representation">
      {watson}
      <br />
      {middle}
      <br />
      {crick}
    </div>
  );
}

export default OverhangsDisplay;
