export function getPlasmidSequencesInLine(line) {
  return line.sequences_in_line.filter(({sequence}) => sequence.sequence_type === 'plasmid').map(({sequence}) => sequence);
}

export function getAlleleSequencesInLine(line) {
  return line.sequences_in_line.filter(({sequence}) => sequence.sequence_type === 'allele').map(({sequence}) => sequence);
}
