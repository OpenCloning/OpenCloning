import React from 'react';
import { batch, useDispatch, useStore } from 'react-redux';
import { cloningActions } from '@opencloning/store/cloning';
import { getEmptyPlaceholderSource } from '@opencloning/store/cloning_utils';
import { graftState, getGraftSequenceId, mergeStates } from '@opencloning/utils/network';
import {
  loadFilesToVerificationStore,
  parseHistoryFile,
  updateVerificationFileNames,
} from '@opencloning/utils/readNwrite';
import useCloningAlerts from './useCloningAlerts';
import useBackendHttpClient from './useBackendHttpClient';
import useValidateState from './useValidateState';

const {
  setState: setCloningState,
  deleteSourceAndItsChildren,
} = cloningActions;

function makeAlertHandler(addAlert, onError, severity = 'error') {
  return onError || ((message) => addAlert({ message, severity }));
}

function shouldDeleteSourceBeforeApply(mode, source) {
  return source != null && mode === 'merge';
}

export default function useCloningHistoryLoader() {
  const dispatch = useDispatch();
  const store = useStore();
  const validateState = useValidateState();
  const { addAlert } = useCloningAlerts();
  const httpClient = useBackendHttpClient();
  const snapgeneUrl = 'read_snapgene_history';

  const applyCloningStrategy = React.useCallback(async (cloningStrategy, options = {}) => {
    const {
      verificationFiles = [],
      mode,
      source = null,
      onError,
    } = options;

    const reportError = makeAlertHandler(addAlert, onError);
    const deleteSourceBeforeApply = shouldDeleteSourceBeforeApply(mode, source);
    const sourceId = source?.id ?? null;

    const prevState = store.getState().cloning;

    try {
      if (deleteSourceBeforeApply) {
        dispatch(deleteSourceAndItsChildren(sourceId));
      }

      const cloningState = store.getState().cloning;
      let newState;
      let idShift = 0;

      if (mode === 'replace') {
        newState = cloningStrategy;
      } else if (mode === 'merge') {
        ({ mergedState: newState, idShift } = mergeStates(cloningStrategy, cloningState));
      } else if (mode === 'graft') {
        ({ mergedState: newState, idShift } = graftState(cloningStrategy, cloningState, sourceId));
      } else {
        throw new Error(`Unknown apply mode: ${mode}`);
      }

      batch(() => {
        dispatch(setCloningState(newState));
      });

      await loadFilesToVerificationStore(verificationFiles, idShift);
    } catch (e) {
      console.error(e);
      dispatch(setCloningState(prevState));
      reportError(e.message);
      throw e;
    }
  }, [addAlert, dispatch, store]);

  const loadHistoryFromFile = React.useCallback(async (file, options = {}) => {
    const { onError } = options;
    const reportError = makeAlertHandler(addAlert, onError);

    let cloningStrategy;
    let verificationFiles;
    try {
      ({ cloningStrategy, verificationFiles } = await parseHistoryFile(file));
    } catch (e) {
      console.error(e);
      reportError(e.message);
      return null;
    }

    const validatedState = await validateState(cloningStrategy);
    const updatedVerificationFiles = updateVerificationFileNames(
      verificationFiles,
      cloningStrategy.files,
      validatedState.files,
    );
    const canGraft = getGraftSequenceId(validatedState) !== null;

    const apply = (applyOptions) => applyCloningStrategy(validatedState, {
      verificationFiles: updatedVerificationFiles,
      validate: false,
      ...applyOptions,
    });

    return {
      cloningStrategy: validatedState,
      verificationFiles: updatedVerificationFiles,
      canGraft,
      replace: (applyOptions = {}) => apply({ mode: 'replace', ...applyOptions }),
      merge: (applyOptions = {}) => apply({ mode: 'merge', ...applyOptions }),
      graft: (applyOptions = {}) => apply({ mode: 'graft', ...applyOptions }),
    };
  }, [addAlert, applyCloningStrategy, validateState]);

  const loadSnapgeneHistory = React.useCallback(async (file, options = {}) => {
    const { source = null, onError, onWarning } = options;
    const reportWarning = makeAlertHandler(addAlert, onWarning, 'warning');

    const cloningState = store.getState().cloning;
    const formData = new FormData();
    formData.append('file', file);
    const config = {
      headers: {
        'content-type': 'multipart/form-data',
      },
    };

    try {
      const resp = await httpClient.post(snapgeneUrl, formData, config);
      const { data: cloningStrategy } = resp;

      const isEmptyState = getEmptyPlaceholderSource(cloningState.sources) !== null;
      const mode = isEmptyState ? 'replace' : 'merge';

      if (resp.headers['x-warning']) {
        reportWarning(`Not all SnapGene history was parsed: ${resp.headers['x-warning']}`);
      }

      await applyCloningStrategy(cloningStrategy, {
        mode,
        source,
        onError,
      });
      return true;
    } catch {
      reportWarning('Failed to parse the history from the SnapGene file, will only read the sequence.');
      return false;
    }
  }, [addAlert, applyCloningStrategy, httpClient, snapgeneUrl, store]);

  return {
    applyCloningStrategy,
    loadHistoryFromFile,
    loadSnapgeneHistory,
  };
}
