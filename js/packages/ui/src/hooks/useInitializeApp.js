import { useEffect } from 'react';
import { clearVerificationFileContents } from '@opencloning/utils/verificationFileStore';

/**
 * Hook to initialize application-level concerns
 * - Clears the in-memory verification file store
 */
export default function useInitializeApp() {

  useEffect(() => {
    clearVerificationFileContents();
  }, []);
}

