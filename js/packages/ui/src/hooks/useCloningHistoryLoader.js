import React from 'react';
import { useDispatch, useStore } from 'react-redux';
import { cloningActions } from '@opencloning/store/cloning';
import { getEmptyPlaceholderSource } from '@opencloning/store/cloning_utils';
import { graftState, getGraftSequenceId, mergeStates } from '@opencloning/utils/network';
import {
  checkCloningStrategyShape,
  fileUploadRequest,
  formatTemplate,
  loadFilesToVerificationStore,
  readHistoryFile,
  updateVerificationFileNames,
} from '@opencloning/utils/readNwrite';
import { getExternalHttpClient } from '@opencloning/utils/httpClients';
import error2String from '@opencloning/utils/error2String';
import useCloningAlerts from './useCloningAlerts';
import useBackendHttpClient from './useBackendHttpClient';
import useValidateState from './useValidateState';

// For examples, templates and strategies from the MCP server (not the backend)
const externalHttpClient = getExternalHttpClient();

const {
  setState: setCloningState,
  deleteSourceAndItsChildren,
  addSourceAndItsOutputSequence,
} = cloningActions;

function makeAlertHandler(addAlert, onError, severity = 'error') {
  return onError || ((message) => addAlert({ message, severity }));
}

function shouldDeleteSourceBeforeApply(mode, source) {
  return source != null && mode === 'merge';
}

/** Post each sequence file to read_from_file, returns the sources, sequences and warnings of all of them. */
async function readSequenceFiles(files, httpClient) {
  const readFile = async (file) => {
    const fileName = file.name;
    const fileContent = await file.arrayBuffer();
    const { requestData, config } = fileUploadRequest(new File([fileContent], fileName));
    try {
      const { data: { sources, sequences }, headers } = await httpClient.post('read_from_file', requestData, config);
      // If there are warnings, add them to the list of warnings
      const warnings = headers['x-warning'] ? [`${fileName}: ${headers['x-warning']}`] : [];
      return { sources, sequences, warnings };
    } catch (e) {
      if (e.code === 'ERR_NETWORK') {
        throw new Error(error2String(e), { cause: e });
      }
      throw new Error(`Could not read the file ${fileName}: ${error2String(e)}`, { cause: e });
    }
  };

  const results = await Promise.all(Array.from(files).map(readFile));
  return {
    sources: results.flatMap((r) => r.sources),
    sequences: results.flatMap((r) => r.sequences),
    warnings: results.flatMap((r) => r.warnings),
  };
}

/**
 * The one way to bring cloning strategies and sequence files into the cloning state, wherever they come from
 * (a file, a url, the database...). Cloning strategies are checked and validated by the backend (which
 * migrates old versions) before they are applied.
 */
export default function useCloningHistoryLoader() {
  const dispatch = useDispatch();
  const store = useStore();
  const validateState = useValidateState();
  const { addAlert } = useCloningAlerts();
  const httpClient = useBackendHttpClient();
  const snapgeneUrl = 'read_snapgene_history';

  /**
   * Apply a cloning strategy that has already been validated. mode is 'replace', 'merge' or 'graft'.
   * If it fails, the previous state is restored, the error is reported (onError or an alert) and rethrown.
   */
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

      dispatch(setCloningState(newState));

      await loadFilesToVerificationStore(verificationFiles, idShift);
    } catch (e) {
      console.error(e);
      dispatch(setCloningState(prevState));
      reportError(e.message);
      throw e;
    }
  }, [addAlert, dispatch, store]);

  // Attach to a cloning strategy that is already validated the functions to apply it (replace, merge & graft).
  // It does not validate it, see validateCloningStrategy.
  const attachApplyFunctions = React.useCallback((cloningStrategy, verificationFiles) => {
    const apply = (applyOptions) => applyCloningStrategy(cloningStrategy, { verificationFiles, ...applyOptions });
    return {
      cloningStrategy,
      verificationFiles,
      canGraft: getGraftSequenceId(cloningStrategy) !== null,
      replace: (applyOptions = {}) => apply({ mode: 'replace', ...applyOptions }),
      merge: (applyOptions = {}) => apply({ mode: 'merge', ...applyOptions }),
      graft: (applyOptions = {}) => apply({ mode: 'graft', ...applyOptions }),
    };
  }, [applyCloningStrategy]);

  /**
   * Check the shape of a cloning strategy and validate it with the backend.
   * Returns { cloningStrategy, verificationFiles, canGraft, replace, merge, graft }, where replace, merge
   * and graft apply it (see applyCloningStrategy). Returns null if the cloning strategy is not valid,
   * and reports the error (onError or an alert).
   */
  const validateCloningStrategy = React.useCallback(async (cloningStrategy, options = {}) => {
    const { verificationFiles = [], onError } = options;
    const reportError = makeAlertHandler(addAlert, onError);
    try {
      checkCloningStrategyShape(cloningStrategy);
    } catch (e) {
      console.error(e);
      reportError(e.message);
      return null;
    }

    const validatedState = await validateState(cloningStrategy);
    const updatedVerificationFiles = updateVerificationFileNames(
      verificationFiles,
      cloningStrategy.files ?? [],
      validatedState.files ?? [],
    );
    return attachApplyFunctions(validatedState, updatedVerificationFiles);
  }, [addAlert, attachApplyFunctions, validateState]);

  /** Read a history file (.json or .zip) and validate it (see validateCloningStrategy). */
  const loadHistoryFromFile = React.useCallback(async (file, options = {}) => {
    const { onError } = options;
    const reportError = makeAlertHandler(addAlert, onError);

    let cloningStrategy;
    let verificationFiles;
    try {
      ({ cloningStrategy, verificationFiles } = await readHistoryFile(file));
    } catch (e) {
      console.error(e);
      reportError(e.message);
      return null;
    }
    return validateCloningStrategy(cloningStrategy, { verificationFiles, onError });
  }, [addAlert, validateCloningStrategy]);

  /**
   * Fetch a history file (.json or .zip) from a url that is not the backend (examples, templates, MCP server)
   * and validate it (see validateCloningStrategy). With isTemplate, the images of the template point to the url.
   * Throws if the request fails or the file is not found. Errors in the file itself are reported (onError
   * or an alert) and null is returned.
   */
  const loadHistoryFromUrl = React.useCallback(async (url, options = {}) => {
    const { isTemplate = false, onError } = options;
    const fileName = url.split('/').pop();

    let validated;
    if (fileName.endsWith('.zip')) {
      const resp = await externalHttpClient.get(url, { responseType: 'blob' });
      // The app's index.html is served for files that do not exist
      if (resp.headers['content-type']?.includes('text/html')) {
        throw new Error('Not found');
      }
      validated = await loadHistoryFromFile(new File([resp.data], fileName), { onError });
    } else {
      const { data } = await externalHttpClient.get(url);
      // A json file is parsed by axios, anything else (e.g. the app's index.html for missing files) is a string
      if (data === null || typeof data !== 'object') {
        throw new Error('Not found');
      }
      // A json file cannot contain verification files
      validated = await validateCloningStrategy({ ...data, files: [] }, { onError });
    }

    if (!validated || !isTemplate) {
      return validated;
    }
    return attachApplyFunctions(formatTemplate(validated.cloningStrategy, url), validated.verificationFiles);
  }, [loadHistoryFromFile, attachApplyFunctions, validateCloningStrategy]);

  /**
   * Read sequence files (genbank, fasta, snapgene...) with the backend, and add each sequence to the
   * cloning state (removing the empty placeholder source, if any). modifySource is applied to each source.
   * Returns true if the files were loaded, otherwise reports the error (onError or an alert) and returns false.
   */
  const loadSequenceFiles = React.useCallback(async (files, options = {}) => {
    const { modifySource = (s) => s, onError } = options;
    const reportError = makeAlertHandler(addAlert, onError);
    try {
      const { sources, sequences, warnings } = await readSequenceFiles(files, httpClient);
      const emptyPlaceholder = getEmptyPlaceholderSource(store.getState().cloning.sources);
      if (emptyPlaceholder) {
        dispatch(deleteSourceAndItsChildren(emptyPlaceholder.id));
      }
      sources.forEach((source, i) => {
        dispatch(addSourceAndItsOutputSequence({ source: modifySource(source), sequence: sequences[i] }));
      });
      warnings.forEach((warning) => addAlert({ message: warning, severity: 'warning' }));
      return true;
    } catch (e) {
      console.error(e);
      reportError(e.message);
      return false;
    }
  }, [addAlert, dispatch, httpClient, store]);

  const loadSnapgeneHistory = React.useCallback(async (file, options = {}) => {
    const { source = null, onError, onWarning } = options;
    const reportWarning = makeAlertHandler(addAlert, onWarning, 'warning');

    const cloningState = store.getState().cloning;
    const { requestData, config } = fileUploadRequest(file);

    try {
      const resp = await httpClient.post(snapgeneUrl, requestData, config);
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
    validateCloningStrategy,
    loadHistoryFromFile,
    loadHistoryFromUrl,
    loadSequenceFiles,
    loadSnapgeneHistory,
  };
}
