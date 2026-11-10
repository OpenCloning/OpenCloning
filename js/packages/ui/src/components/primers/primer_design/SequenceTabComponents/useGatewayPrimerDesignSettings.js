import { useState } from 'react';
import usePrimerDesignSettings from './usePrimerDesignSettings';

export default function useGatewayPrimerDesignSettings(initialSettings) {
  const primerDesignSettings = usePrimerDesignSettings(initialSettings);

  // Gateway BP
  const [knownCombination, setKnownCombination] = useState(null);

  const error = primerDesignSettings.error || (!knownCombination && 'No valid combination of attP sites selected');

  return {
    ...primerDesignSettings,
    knownCombination,
    setKnownCombination,
    error,
  };
}
