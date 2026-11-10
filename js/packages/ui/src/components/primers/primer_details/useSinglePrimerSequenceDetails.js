import React from 'react';
import { usePrimerDetailsEndpoints } from './usePrimerDetailsEndpoints';

export function useSinglePrimerSequenceDetails(sequence) {
  const [primerDetails, setPrimerDetails] = React.useState({ status: 'loading' });
  const { getPrimerDetails } = usePrimerDetailsEndpoints();
  const [connectionAttempt, setConnectionAttempt] = React.useState(0);

  const retryGetPrimerDetails = () => setConnectionAttempt((prev) => prev + 1);

  React.useEffect(() => {
    const fetchPrimerDetails = async () => {
      try {
        const details = await getPrimerDetails(sequence);
        setPrimerDetails({ status: 'success', ...details });
      } catch (error) {
        console.error(error);
        setPrimerDetails({ status: 'error', error });
      }
    };
    fetchPrimerDetails();
  }, [sequence, connectionAttempt]);

  return { primerDetails, retryGetPrimerDetails };
}
