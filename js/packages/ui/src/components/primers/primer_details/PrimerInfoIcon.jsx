import { Dialog, DialogContent, IconButton, Tooltip, Table, TableBody } from '@mui/material';
import React from 'react';
import { Info as InfoIcon, Warning as WarningIcon } from '@mui/icons-material';
import { formatGcContent, formatMeltingTemperature, formatDeltaG } from './primerDetailsFormatting';
import Primer3Figure from './Primer3Figure';
import TableSection from './TableSection';
import PCRTable from './PCRTable';

export function PrimerInfoDialog({ primerDetails, open, onClose, pcrDetails }) {
  const relatedPcrDetails = pcrDetails.filter(({ fwdPrimer, rvsPrimer }) => fwdPrimer.id === primerDetails.id || rvsPrimer.id === primerDetails.id);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogContent>

        <Table size="small">
          <TableBody>
            <TableSection
              title="Full sequence"
              values={[
                ['Name', primerDetails.name],
                ['Length', primerDetails.length],
                ['Tm (full sequence)', `${formatMeltingTemperature(primerDetails.melting_temperature)} °C`],
                ['GC% (full sequence)', `${formatGcContent(primerDetails.gc_content)}%`],
              ]}
            />
            {/* TODO: Warning if length > 60 */}
            {primerDetails.homodimer && (
            <>
              <TableSection
                title="Homodimer"
                values={[
                  ['Tm (homodimer)', `${formatMeltingTemperature(primerDetails.homodimer.melting_temperature)} °C`],
                  ['ΔG (homodimer)', `${formatDeltaG(primerDetails.homodimer.deltaG)} cal/mol`],
                ]}
              />
              <Primer3Figure figure={primerDetails.homodimer.figure} />
            </>
            )}
            {primerDetails.hairpin && (
            <>
              <TableSection
                title="Hairpin"
                values={[
                  ['Tm (hairpin)', `${formatMeltingTemperature(primerDetails.hairpin.melting_temperature)} °C`],
                  ['ΔG (hairpin)', `${formatDeltaG(primerDetails.hairpin.deltaG)} cal/mol`],
                ]}
              />
              <Primer3Figure figure={primerDetails.hairpin.figure} />
            </>
            )}
          </TableBody>
        </Table>
        {relatedPcrDetails.map((pcrDetail) => (
          <PCRTable
            key={pcrDetail.sourceId}
            pcrDetail={pcrDetail}
          />
        ))}

      </DialogContent>
    </Dialog>
  );
}

const primerProblematicValues = (primerDetails, pcrDetails) => {
  const pcrDetail = pcrDetails.find(({ fwdPrimer, rvsPrimer }) => fwdPrimer.id === primerDetails.id || rvsPrimer.id === primerDetails.id);
  const problematicValues = {
    homodimer: '',
    hairpin: '',
    gcContent: '',
    meltingTemperature: '',
  };
  let gcContent = primerDetails.gc_content;
  let meltingTemperature = primerDetails.melting_temperature;
  if (pcrDetail) {
    const pcrPrimer = primerDetails.id === pcrDetail.fwdPrimer.id ? pcrDetail.fwdPrimer : pcrDetail.rvsPrimer;
    meltingTemperature = pcrPrimer.melting_temperature;
    gcContent = pcrPrimer.gc_content;
  }

  if (gcContent < 0.30 || gcContent > 0.70) {
    problematicValues.gcContent = 'GC content is outside the optimal range';
  }
  if (meltingTemperature < 50 || meltingTemperature > 70) {
    problematicValues.meltingTemperature = 'Melting temperature is outside the optimal range';
  }

  return problematicValues;
  if (primerDetails.homodimer && primerDetails.homodimer.deltaG < -8000) {
    problematicValues.homodimer = 'May form homodimers';
  }
  if (primerDetails.hairpin && primerDetails.hairpin.deltaG < -8000) {
    problematicValues.hairpin = 'May form hairpins';
  }

  return problematicValues;
};

const primerWarning = (problematicValues) => {
  const field = Object.keys(problematicValues).find((key) => problematicValues[key] !== '');
  return field ? problematicValues[field] : '';
};

function PrimerInfoIcon({ primerDetails, pcrDetails }) {
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const warning = primerWarning(primerProblematicValues(primerDetails, pcrDetails));
  let tooltipTitle = 'Primer details';
  const disabled = primerDetails.melting_temperature === undefined;
  if (disabled) {
    tooltipTitle = 'Primer details not available';
  } else if (warning !== '') {
    tooltipTitle = warning;
  }
  return (
    <>
      <Tooltip title={tooltipTitle} placement="top" arrow>
        {/* This span is necessary to work when the button is disabled */}
        <span>
          <IconButton disabled={disabled} onClick={handleOpen}>
            {warning === '' ? <InfoIcon /> : <WarningIcon color="warning" />}
          </IconButton>
        </span>
      </Tooltip>
      {open && <PrimerInfoDialog primerDetails={primerDetails} open={open} onClose={handleClose} pcrDetails={pcrDetails} />}
    </>
  );
}

export default PrimerInfoIcon;
