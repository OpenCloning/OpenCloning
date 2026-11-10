import { useState, useCallback } from 'react';
import { batch, useDispatch, useStore } from 'react-redux';
import useBackendHttpClient from '../../../../../hooks/useBackendHttpClient';
import useStoreEditor from '../../../../../hooks/useStoreEditor';
import error2String from '@opencloning/utils/error2String';
import { cloningActions } from '@opencloning/store/cloning';
import designTypeStrategies from '../designTypeStrategies';

const { addPrimersToPCRSource, setMainSequenceId, setCurrentTab } = cloningActions;

export default function useDesignPrimers({
  designType, sequenceIds, templateSequenceIds, isAmplified,
  rois, fragmentOrientations, spacers, circularAssembly, primerDesignSettings,
  handleNext, onTabChange,
}) {
  const [primers, setPrimers] = useState([]);
  const [error, setError] = useState('');

  const store = useStore();
  const dispatch = useDispatch();
  const httpClient = useBackendHttpClient();
  const { updateStoreEditor } = useStoreEditor();

  const designPrimers = useCallback(async () => {
    fragmentOrientations.forEach((orientation) => {
      if (orientation !== 'forward' && orientation !== 'reverse') {
        throw new Error('Invalid fragment orientation');
      }
    });

    const { cloning: { sequences, teselaJsonCache, globalPrimerSettings } } = store.getState();
    const paramsForRequest = Object.fromEntries(
      Object.entries(primerDesignSettings)
        .filter(([_, value]) => typeof value !== 'function'),
    );

    const strategy = designTypeStrategies[designType];
    const { endpoint, params, requestData } = strategy.buildRequest({
      sequences, sequenceIds, templateSequenceIds, rois, fragmentOrientations,
      spacers, circularAssembly, isAmplified, teselaJsonCache, paramsForRequest,
    });

    requestData.settings = globalPrimerSettings;
    const url = `primer_design/${endpoint}`;

    try {
      const resp = await httpClient.post(url, requestData, { params });
      setError('');
      setPrimers(resp.data.primers);
      handleNext();
      return false;
    } catch (thrownError) {
      setError(error2String(thrownError));
      return true;
    }
  }, [fragmentOrientations, rois, sequenceIds, templateSequenceIds, designType, circularAssembly, primerDesignSettings, spacers, store, httpClient, handleNext, isAmplified]);

  const addPrimers = useCallback(() => {
    const pcrSources = store.getState().cloning.sources.filter((source) => source.type === 'PCRSource');
    let usedPCRSources;
    if (designType === 'ebic') {
      usedPCRSources = pcrSources.filter((source) => source.input.some((i) => i.sequence === templateSequenceIds[0]));
    } else {
      const amplifiedTemplateIds = templateSequenceIds.filter((_, i) => isAmplified[i]);
      usedPCRSources = amplifiedTemplateIds.map((id) => pcrSources.find((source) => source.input.some((i) => i.sequence === id)));
    }

    const validPrimers = primers.filter((p) => p !== null);
    batch(() => {
      usedPCRSources.forEach((pcrSource, index) => {
        dispatch(addPrimersToPCRSource({
          fwdPrimer: validPrimers[index * 2],
          revPrimer: validPrimers[index * 2 + 1],
          sourceId: pcrSource.id,
        }));
      });
      dispatch(setMainSequenceId(null));
      dispatch(setCurrentTab(0));
    });
    setPrimers([]);
    onTabChange(null, 0);
    document.getElementById(`source-${usedPCRSources[0].id}`)?.scrollIntoView();
    updateStoreEditor('mainEditor', null);
  }, [primers, dispatch, onTabChange, updateStoreEditor, designType, templateSequenceIds, isAmplified, store]);

  return { primers, setPrimers, error, designPrimers, addPrimers };
}
