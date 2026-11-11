import { getReverseComplementSequenceString as reverseComplement } from '@teselagen/sequence-utils';

const knownGatewayCombinations = [
  {
    siteNames: ['attP4', 'attP1'],
    spacers: ['GGGGACAACTTTGTATAGAAAAGTTGNN', reverseComplement('GGGGACTGCTTTTTTGTACAAACTTGN')],
    orientation: [true, true],
    message: 'Primers tails designed based on pDONR™ P4-P1R',
    translationFrame: [4, 6],
  },
  {
    siteNames: ['attP1', 'attP2'],
    spacers: ['GGGGACAAGTTTGTACAAAAAAGCAGGCTNN', reverseComplement('GGGGACCACTTTGTACAAGAAAGCTGGGTN')],
    orientation: [true, false],
    message: 'Primers tails designed based on pDONR™ 221',
    translationFrame: [4, 6],
  },
  {
    siteNames: ['attP2', 'attP3'],
    spacers: ['GGGGACAGCTTTCTTGTACAAAGTGGNN', reverseComplement('GGGGACAACTTTGTATAATAAAGTTGN')],
    orientation: [false, false],
    message: 'Primers tails designed based on pDONR™ P2R-P3',
    translationFrame: [4, 6],
  },
];

export default knownGatewayCombinations;
