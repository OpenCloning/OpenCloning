import React from 'react';
import { isEqual } from 'lodash-es';
import { useSelector } from 'react-redux';
import { getPrimerBindingInfoFromSource } from '@opencloning/store/cloning_utils';
import { usePrimerDetailsEndpoints } from './usePrimerDetailsEndpoints';

export function usePCRDetails(sourceIds) {
  const [pcrDetails, setPcrDetails] = React.useState([]);
  const [requestStatus, setRequestStatus] = React.useState({ status: 'loading', message: '' });
  const [connectionAttempt, setConnectionAttempt] = React.useState(0);
  const retryGetPCRDetails = () => setConnectionAttempt((prev) => prev + 1);

  const { getPrimerDetails, getHeterodimerDetails } = usePrimerDetailsEndpoints();
  const bindingInfos = useSelector((state) => {
    const { primers, sources, teselaJsonCache } = state.cloning;

    return sourceIds.map((sourceId) => {
      const source = sources.find((s) => s.id === sourceId);
      const sequenceLength = source.type === 'PCRSource' && teselaJsonCache[source.input[1].sequence].size;
      return getPrimerBindingInfoFromSource(primers, source, sequenceLength);
    });
  }, isEqual);

  React.useEffect(() => {
    const fetchPrimerDetails = async (bindingInfo) => {
      let fwdPrimer = await getPrimerDetails(bindingInfo.fwdPrimer.sequence.slice(-bindingInfo.fwdLength));
      fwdPrimer = { ...fwdPrimer, ...bindingInfo.fwdPrimer };
      let rvsPrimer = await getPrimerDetails(bindingInfo.rvsPrimer.sequence.slice(-bindingInfo.rvsLength));
      rvsPrimer = { ...rvsPrimer, ...bindingInfo.rvsPrimer };
      const heterodimer = await getHeterodimerDetails(bindingInfo.fwdPrimer.sequence, bindingInfo.rvsPrimer.sequence);
      return { sourceId: bindingInfo.sourceId, sourceType: bindingInfo.sourceType, fwdPrimer, rvsPrimer, heterodimer };
    };
    const getAllDetails = async () => {
      setRequestStatus({ status: 'loading', message: 'loading' });
      try {
        const details = await Promise.all(bindingInfos.map(fetchPrimerDetails));
        setPcrDetails(details);
        setRequestStatus({ status: 'success', message: '' });
      } catch (error) {
        setRequestStatus({ status: 'error', message: `Error fetching PCR details: ${error.message}` });
      }
    };
    getAllDetails();
  }, [bindingInfos, connectionAttempt, getPrimerDetails, getHeterodimerDetails]);

  return { pcrDetails, retryGetPCRDetails, requestStatus };
}
