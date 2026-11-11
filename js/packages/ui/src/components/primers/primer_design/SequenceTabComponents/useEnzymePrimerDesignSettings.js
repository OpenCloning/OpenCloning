import { useEffect, useState } from 'react';
import { getReverseComplementSequenceString as reverseComplement } from '@teselagen/sequence-utils';
import { getEnzymeRecognitionSequence } from '@opencloning/utils/enzyme_utils';
import { stringIsNotDNA } from '@opencloning/store/cloning_utils';
import usePrimerDesignSettings from './usePrimerDesignSettings';

function getError(enzymePrimerDesignSettings) {
  const { left_enzyme: leftEnzyme, right_enzyme: rightEnzyme, filler_bases: fillerBases } = enzymePrimerDesignSettings;
  if (!leftEnzyme && !rightEnzyme) {
    return 'You must select and enzyme';
  }
  if (stringIsNotDNA(fillerBases)) {
    return 'Filler bases not valid';
  }
  return '';
}

export default function useEnzymePrimerDesignSettings(defaultSettings) {
  const primerDesignSettings = usePrimerDesignSettings(defaultSettings);
  const [enzymePrimerDesignSettings, setEnzymePrimerDesignSettings] = useState({
    left_enzyme: null,
    right_enzyme: null,
    left_enzyme_inverted: false,
    right_enzyme_inverted: false,
    filler_bases: 'TTT',
    enzymeSpacers: ['', ''],
  });
  const [enzymeError, setEnzymeError] = useState(getError(enzymePrimerDesignSettings));

  const updateEnzymeSettings = (newSettings) => {
    setEnzymePrimerDesignSettings((prev) => ({ ...prev, ...newSettings }));
  };

  useEffect(() => {
    const { left_enzyme: leftEnzyme, right_enzyme: rightEnzyme, filler_bases: fillerBases, left_enzyme_inverted: leftEnzymeInverted, right_enzyme_inverted: rightEnzymeInverted } = enzymePrimerDesignSettings;
    if ((leftEnzyme || rightEnzyme) && !stringIsNotDNA(fillerBases)) {
      const leftEnzymeSeq = leftEnzymeInverted ? reverseComplement(getEnzymeRecognitionSequence(leftEnzyme)) : getEnzymeRecognitionSequence(leftEnzyme);
      const rightEnzymeSeq = rightEnzymeInverted ? getEnzymeRecognitionSequence(rightEnzyme) : reverseComplement(getEnzymeRecognitionSequence(rightEnzyme));
      const leftSpacerStartingSeq = (leftEnzyme ? fillerBases : '') + leftEnzymeSeq;
      const rightSpacerEndingSeq = rightEnzymeSeq + reverseComplement((rightEnzyme ? fillerBases : ''));
      setEnzymePrimerDesignSettings((prev) => ({ ...prev, enzymeSpacers: [leftSpacerStartingSeq, rightSpacerEndingSeq] }));
    } else {
      setEnzymePrimerDesignSettings((prev) => ({ ...prev, enzymeSpacers: ['', ''] }));
    }
    setEnzymeError(getError(enzymePrimerDesignSettings));
  }, [
    enzymePrimerDesignSettings.left_enzyme,
    enzymePrimerDesignSettings.right_enzyme,
    enzymePrimerDesignSettings.filler_bases,
    enzymePrimerDesignSettings.left_enzyme_inverted,
    enzymePrimerDesignSettings.right_enzyme_inverted,
  ]);

  const error = primerDesignSettings.error || enzymeError;

  return { ...primerDesignSettings, ...enzymePrimerDesignSettings, updateEnzymeSettings, error };
}
