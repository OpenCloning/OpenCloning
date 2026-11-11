import React from 'react';
import { PrimerDesignProvider } from './PrimerDesignContext';
import PrimerDesignForm from './PrimerDesignForm';
import usePrimerDesignSettings from './usePrimerDesignSettings';
import { getPcrTemplateSequenceId } from '@opencloning/store/cloning_utils';

export default function PrimerDesignHomologousRecombination({ homologousRecombinationTargetId, pcrSource }) {
  const templateSequenceId = getPcrTemplateSequenceId(pcrSource);
  const sequenceIds = React.useMemo(() => [templateSequenceId, homologousRecombinationTargetId], [templateSequenceId, homologousRecombinationTargetId]);
  const steps = React.useMemo(() => [
    { label: 'Amplified region',
      description: `Select the fragment of sequence ${templateSequenceId} to be amplified in the editor and click "Choose region"`,
      inputLabel: `Amplified region (sequence ${templateSequenceId})` },
    { label: 'Replaced region',
      description: 'Select the single position (insertion) or region (replacement) where recombination will introduce the amplified fragment',
      inputLabel: `Replaced region (sequence ${homologousRecombinationTargetId})`,
      allowSinglePosition: true,
    },
  ], [templateSequenceId, homologousRecombinationTargetId]);

  const primerDesignSettings = usePrimerDesignSettings({ homology_length: 80, minimal_hybridization_length: 14, target_tm: 55 });
  return (
    <PrimerDesignProvider
      designType="homologous_recombination"
      sequenceIds={sequenceIds}
      primerDesignSettings={primerDesignSettings}
      steps={steps}
    >
      <PrimerDesignForm />
    </PrimerDesignProvider>
  );
}
