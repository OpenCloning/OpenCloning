import React from 'react';
import { PrimerDesignProvider } from './PrimerDesignContext';
import PrimerDesignForm from './PrimerDesignForm';
import useEnzymePrimerDesignSettings from './useEnzymePrimerDesignSettings';
import { getPcrTemplateSequenceId } from '@opencloning/store/cloning_utils';

function PrimerDesignRestriction({ pcrSource }) {
  const templateSequenceId = getPcrTemplateSequenceId(pcrSource);
  const sequenceIds = React.useMemo(() => [templateSequenceId], [templateSequenceId]);

  const steps = React.useMemo(() => [
    { label: 'Amplified region' },
  ], []);

  const primerDesignSettings = useEnzymePrimerDesignSettings({ homology_length: null, minimal_hybridization_length: 14, target_tm: 55 });

  return (
    <PrimerDesignProvider designType="restriction_ligation" sequenceIds={sequenceIds} primerDesignSettings={primerDesignSettings} steps={steps}>
      <PrimerDesignForm />
    </PrimerDesignProvider>

  );
}

export default PrimerDesignRestriction;
