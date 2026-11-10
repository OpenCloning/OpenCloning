import React from 'react';
import { Table, TableBody } from '@mui/material';
import { formatGcContent, formatMeltingTemperature, formatDeltaG } from './primerDetailsFormatting';
import Primer3Figure from './Primer3Figure';
import TableSection from './TableSection';

export default function PCRTable({ pcrDetail }) {
  const { sourceId, sourceType, fwdPrimer, rvsPrimer, heterodimer } = pcrDetail;
  const name = (sourceType === 'PCRSource') ? 'PCR' : 'Oligonucleotide hybridization';

  return (
    <Table size="small" className="pcr-table">
      <TableBody />

      <TableSection
        title={`${name} ${sourceId}`}
        values={[
          ['Primer names', fwdPrimer.name, rvsPrimer.name],
          ['Binding length', fwdPrimer.length, rvsPrimer.length],
          ['Tm (binding)', `${formatMeltingTemperature(fwdPrimer.melting_temperature)} °C`, `${formatMeltingTemperature(rvsPrimer.melting_temperature)} °C`],
          ['GC% (binding)', `${formatGcContent(fwdPrimer.gc_content)}%`, `${formatGcContent(rvsPrimer.gc_content)}%`],
          ['Tm difference', `${formatMeltingTemperature(fwdPrimer.melting_temperature - rvsPrimer.melting_temperature)} °C`],
        ]}
      />
      {heterodimer && (
      <>
        <TableSection
          values={[['Tm (heterodimer)', `${formatMeltingTemperature(heterodimer.melting_temperature)} °C`], ['ΔG (heterodimer)', `${formatDeltaG(heterodimer.deltaG)} cal/mol`]]}
        />
        <Primer3Figure figure={heterodimer.figure} />
      </>
      )}
    </Table>
  );
}
