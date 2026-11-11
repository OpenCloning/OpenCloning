import { formatDeltaG, formatGcContent, formatMeltingTemperature } from './primer_details/primerDetailsFormatting';

export default function primersToTabularFile(primerDetails, pcrDetails, separator) {
  if (primerDetails.length === 0) {
    return '';
  }
  const rowsAsObjects = primerDetails.map((primer) => {
    const pcrDetail = pcrDetails.find(({ fwdPrimer, rvsPrimer }) => fwdPrimer.id === primer.id || rvsPrimer.id === primer.id);
    const pcrPart = {
      pcr_source_id: '',
      binding_length: '',
      binding_melting_temperature: '',
      binding_gc_content: '',
      heterodimer_melting_temperature: '',
      heterodimer_deltaG: '',
    };
    if (pcrDetail) {
      const pcrPrimer = primer.id === pcrDetail.fwdPrimer.id ? pcrDetail.fwdPrimer : pcrDetail.rvsPrimer;
      pcrPart.pcr_source_id = pcrDetail.sourceId;
      pcrPart.binding_length = pcrPrimer.length;
      pcrPart.binding_melting_temperature = formatMeltingTemperature(pcrPrimer.melting_temperature);
      pcrPart.binding_gc_content = formatGcContent(pcrPrimer.gc_content);
      if (pcrDetail.heterodimer) {
        pcrPart.heterodimer_melting_temperature = formatMeltingTemperature(pcrDetail.heterodimer.melting_temperature);
        pcrPart.heterodimer_deltaG = formatDeltaG(pcrDetail.heterodimer.deltaG);
      }
    }
    return {
      id: primer.id,
      name: primer.name,
      sequence: primer.sequence,
      length: primer.length,
      melting_temperature: formatMeltingTemperature(primer.melting_temperature),
      gc_content: formatGcContent(primer.gc_content),
      homodimer_melting_temperature: formatMeltingTemperature(primer.homodimer?.melting_temperature),
      homodimer_deltaG: formatDeltaG(primer.homodimer?.deltaG),
      hairpin_melting_temperature: formatMeltingTemperature(primer.hairpin?.melting_temperature),
      hairpin_deltaG: formatDeltaG(primer.hairpin?.deltaG),
      ...pcrPart,
    };
  });

  const headers = Object.keys(rowsAsObjects[0]);
  // We don't use Object.values(row) because otherwise undefined values are not included
  const rows = rowsAsObjects.map((row) => Object.keys(row).map((key) => row[key]).join(separator));
  const out = [headers.join(separator), ...rows].join('\n');

  return out;
}
