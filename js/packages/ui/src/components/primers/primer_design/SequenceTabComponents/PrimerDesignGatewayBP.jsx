import React from 'react';
import { PrimerDesignProvider } from './PrimerDesignContext';
import PrimerDesignForm from './PrimerDesignForm';

import useGatewayPrimerDesignSettings from './useGatewayPrimerDesignSettings';
import { getPcrTemplateSequenceId } from '@opencloning/store/cloning_utils';

function PrimerDesignGatewayBP({ donorVectorId, pcrSource }) {
  const templateSequenceId = getPcrTemplateSequenceId(pcrSource);
  const sequenceIds = React.useMemo(() => [templateSequenceId, donorVectorId], [templateSequenceId, donorVectorId]);
  const steps = React.useMemo(() => [
    { label: 'Amplified region',
      description: `Select the fragment of sequence ${templateSequenceId} to be amplified in the editor and click "Choose region"`,
      inputLabel: `Amplified region (sequence ${templateSequenceId})` },
    { label: 'Replaced region',
      description: 'Select attP sites between which the PCR product will be inserted',
      inputLabel: `Replaced region (sequence ${donorVectorId})`,
      stepCompletionToolTip: 'Select a valid combination of attP sites',
    },
  ], [templateSequenceId, donorVectorId]);

  const primerDesignSettings = useGatewayPrimerDesignSettings({ homology_length: null, minimal_hybridization_length: 14, target_tm: 55 });

  return (
    <PrimerDesignProvider
      designType="gateway_bp"
      sequenceIds={sequenceIds}
      primerDesignSettings={primerDesignSettings}
      steps={steps}
    >
      <PrimerDesignForm />
    </PrimerDesignProvider>
  );
}

export default PrimerDesignGatewayBP;
