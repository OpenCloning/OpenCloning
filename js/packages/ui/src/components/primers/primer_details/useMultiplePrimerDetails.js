import React from 'react';
import { usePrimerDetailsEndpoints } from './usePrimerDetailsEndpoints';

export default function useMultiplePrimerDetails(primers) {
  const [primerDetails, setPrimerDetails] = React.useState([]);
  const [connectionAttempt, setConnectionAttempt] = React.useState(0);
  const [requestStatus, setRequestStatus] = React.useState({ status: 'loading' });

  const retryGetPrimerDetails = () => setConnectionAttempt((prev) => prev + 1);

  const { getPrimerDetails } = usePrimerDetailsEndpoints();
  React.useEffect(() => {
    const fetchPrimerDetails = async () => {
      try {
        setRequestStatus({ status: 'loading' });
        const details1 = await Promise.all(primers.map((primer) => getPrimerDetails(primer.sequence)));
        const details2 = details1.map((detail, index) => ({ ...detail, ...primers[index] }));
        setPrimerDetails(details2);
        setRequestStatus({ status: 'success' });
      } catch (error) {
        console.error(error);
        setRequestStatus({ status: 'error', message: `Error fetching primer details: ${error.message}` });
      }
    };
    fetchPrimerDetails();
  }, [primers, connectionAttempt, getPrimerDetails]);

  return { primerDetails, retryGetPrimerDetails, requestStatus };
}
