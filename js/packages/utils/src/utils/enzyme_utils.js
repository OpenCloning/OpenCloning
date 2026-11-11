import { aliasedEnzymesByName, getReverseComplementSequenceString as reverseComplement } from '@teselagen/sequence-utils';
import ambiguousDnaBases from './ambiguous_dna_bases.json';

const enzymeArray = Object.values(aliasedEnzymesByName);

export function getEnzymeRecognitionSequence(enzyme) {
  if (!enzyme) {
    return '';
  }
  const recognitionSeq = enzymeArray.find((e) => e.aliases.includes(enzyme))?.site;
  if (!recognitionSeq) {
    return '????';
  }
  return recognitionSeq.split('').map((base) => (base in ambiguousDnaBases ? ambiguousDnaBases[base] : base)).join('');
}

export function isEnzymePalindromic(enzyme) {
  const recognitionSeq = getEnzymeRecognitionSequence(enzyme);
  return recognitionSeq === reverseComplement(recognitionSeq);
}
