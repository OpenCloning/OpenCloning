import React from 'react';
import { PrimerDesignProvider } from './PrimerDesignContext';
import PrimerDesignForm from './PrimerDesignForm';
import usePrimerDesignSettings from './usePrimerDesignSettings';

export default function PrimerDesignGibsonAssembly({ assemblyInputsInOrder, circularAssembly }) {
  const templateSequencesIds = React.useMemo(
    () => assemblyInputsInOrder.map((x) => x.templateSequenceId),
    [assemblyInputsInOrder],
  );
  const isAmplified = React.useMemo(
    () => assemblyInputsInOrder.map((x) => x.isAmplified),
    [assemblyInputsInOrder],
  );

  const steps = React.useMemo(() => [
    ...templateSequencesIds.map((id) => (
      { label: `Seq ${id}`, selectOrientation: true }
    )),
  ], [templateSequencesIds]);

  const primerDesignSettings = usePrimerDesignSettings({ homology_length: 35, minimal_hybridization_length: 14, target_tm: 55 });
  return (
    <PrimerDesignProvider
      designType="gibson_assembly"
      sequenceIds={templateSequencesIds}
      primerDesignSettings={primerDesignSettings}
      steps={steps}
      isAmplified={isAmplified}
      circularAssembly={circularAssembly}
    >
      <PrimerDesignForm />
    </PrimerDesignProvider>
  );
}
