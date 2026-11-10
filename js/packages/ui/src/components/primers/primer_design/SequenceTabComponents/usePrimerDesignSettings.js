import React from 'react';
import primerDesignMinimalValues from './primerDesignMinimalValues.json';

const getError = (s) => {
  const valid = (s.homology_length === null || s.homology_length >= primerDesignMinimalValues.homology_length)
  && s.minimal_hybridization_length >= primerDesignMinimalValues.hybridization_length
  && s.target_tm >= primerDesignMinimalValues.target_tm;
  if (!valid) {
    return 'Invalid settings';
  }
  return null;
};

export default function usePrimerDesignSettings(defaultSettings) {
  const [settings, setSettings] = React.useState(defaultSettings);
  const [error, setError] = React.useState(getError(defaultSettings));

  const updateSettings = (newSettings) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  React.useEffect(() => {
    setError(getError(settings));
  }, [settings]);

  return {
    ...settings,
    error,
    updateSettings,
  };
}
