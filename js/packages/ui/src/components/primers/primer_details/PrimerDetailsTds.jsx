import { Skeleton } from '@mui/material';
import React from 'react';
import { formatGcContent, formatMeltingTemperature } from './primerDetailsFormatting';

function PrimerDetailsTds({ primerDetails, pcrDetails }) {
  // A primer could be involved in multiple PCR reactions, so we pick the one in which it has the longest
  // annealing length for display in the table.
  const pcrDetail = pcrDetails.find(({ fwdPrimer, rvsPrimer }) => fwdPrimer.id === primerDetails.id || rvsPrimer.id === primerDetails.id);

  const loadingOrErrorComponent = <Skeleton variant="text" height={20} />;
  let meltingTemperature = formatMeltingTemperature(primerDetails.melting_temperature);
  let gcContent = formatGcContent(primerDetails.gc_content);
  let { length } = primerDetails;
  if (pcrDetail) {
    const pcrPrimerDetail = primerDetails.id === pcrDetail.fwdPrimer.id ? pcrDetail.fwdPrimer : pcrDetail.rvsPrimer;
    // We pick the pair with the highest binding length for display here
    meltingTemperature = `${formatMeltingTemperature(pcrPrimerDetail.melting_temperature)} (${meltingTemperature})`;
    gcContent = `${formatGcContent(pcrPrimerDetail.gc_content)} (${gcContent})`;
    length = `${pcrPrimerDetail.length} (${length})`;
  }
  return (
    <>
      <td style={{ whiteSpace: 'nowrap' }} className="length">{length}</td>
      {primerDetails.gc_content !== undefined ? (
        <>
          <td style={{ whiteSpace: 'nowrap' }} className="melting-temperature">{meltingTemperature}</td>
          <td style={{ whiteSpace: 'nowrap' }} className="gc-content">{gcContent}</td>
        </>
      ) : (
        <>
          <td style={{ whiteSpace: 'nowrap' }} className="melting-temperature">{loadingOrErrorComponent}</td>
          <td style={{ whiteSpace: 'nowrap' }} className="gc-content">{loadingOrErrorComponent}</td>
        </>
      )}
    </>
  );
}

export default PrimerDetailsTds;
