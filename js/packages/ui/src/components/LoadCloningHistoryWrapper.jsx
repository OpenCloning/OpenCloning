import React from 'react';
import { batch, useDispatch, useStore } from 'react-redux';
import useCloningAlerts from '../hooks/useCloningAlerts';
import useCloningHistoryLoader from '../hooks/useCloningHistoryLoader';
import { getEmptyPlaceholderSource } from '@opencloning/store/cloning_utils';
import { cloningActions } from '@opencloning/store/cloning';
import HistoryLoadedDialog from './HistoryLoadedDialog';
import useBackendHttpClient from '../hooks/useBackendHttpClient';

const { deleteSourceAndItsChildren, addSourceAndItsOutputSequence } = cloningActions;

async function processSequenceFiles(files, httpClient) {
  const allSources = [];
  const allSequences = [];
  const allWarnings = [];

  const processFile = async (file) => {
    const fileName = file.name;
    const fileContent = await file.arrayBuffer();
    const newFile = new File([fileContent], fileName);

    const formData = new FormData();
    formData.append('file', newFile);
    const config = {
      headers: {
        'content-type': 'multipart/form-data',
      },
    };
    const url = 'read_from_file';
    try {
      const { data: { sources, sequences }, headers } = await httpClient.post(url, formData, config);
      // If there are warnings, add them to the list of warnings
      const warnings = headers['x-warning'] ? [`${fileName}: ${headers['x-warning']}`] : [];
      return { sources, sequences, warnings };
    } catch (e) {
      if (e.code === 'ERR_NETWORK') {
        throw new Error('Cannot connect to backend server');
      } else {
        console.error(e);
        throw new Error(`Could not read the file ${fileName}`);
      }
    }
  };

  const results = await Promise.all(Array.from(files).map((file) => processFile(file)));

  results.forEach(({ sources, sequences, warnings }) => {
    allSources.push(...sources);
    allSequences.push(...sequences);
    allWarnings.push(...warnings);
  });

  return { sources: allSources, sequences: allSequences, warnings: allWarnings };
}

function LoadCloningHistoryWrapper({ fileList, clearFiles, children }) {
  const { addAlert } = useCloningAlerts();
  const dispatch = useDispatch();
  const store = useStore();
  const httpClient = useBackendHttpClient();
  const { loadHistoryFromFile, loadSnapgeneHistory } = useCloningHistoryLoader();
  const [fileLoaderFunctions, setFileLoaderFunctions] = React.useState(null);

  React.useEffect(() => {
    if (fileList.length === 0) {
      return;
    }
    setFileLoaderFunctions(null);
    const files = Array.from(fileList);
    clearFiles();
    const processFileSubmission = async () => {
      const cloningState = store.getState().cloning;
      const isZipFile = files.length === 1 && files[0].name.endsWith('.zip');
      const isJsonFile = files.length === 1 && files[0].name.endsWith('.json');
      // If the file is a zip or json file, load the history file
      if (isZipFile || isJsonFile) {
        const prepared = await loadHistoryFromFile(files[0]);
        if (!prepared) {
          return;
        }

        const errorWrapper = (fn) => async () => {
          try {
            await fn();
          } catch (e) {
            console.error(e);
            addAlert({ message: e.message, severity: 'error' });
          }
        };
        // If there are no sequences in the cloning state, load the history file
        if (cloningState.sequences.length === 0) {
          errorWrapper(prepared.replace)();
        } else {
          setFileLoaderFunctions({
            addState: errorWrapper(prepared.merge),
            replaceState: errorWrapper(prepared.replace),
            clear: () => setFileLoaderFunctions(null),
          });
        }
        // If there are sequences in the cloning state, give the option to merge or replace

        return;
        // You cannot drop a zip or json file and a sequence file at the same time
      } else if (files.some((file) => file.name.endsWith('.json') || file.name.endsWith('.zip'))) {
        addAlert({
          message: 'Drop either a single JSON/zip file or multiple sequence files. Not both.',
          severity: 'error',
        });
        return;
        // Process a bunch of sequence files
      } else if (files.length === 1 && files[0].name.endsWith('.dna')) {
        const success = await loadSnapgeneHistory(files[0]);
        if (success) {
          return;
        }
      }
      try {
        const { sources, sequences, warnings } = await processSequenceFiles(files, httpClient);
        batch(() => {
          // If there is only one source and it is empty, delete it
          const emptyPlaceholder = getEmptyPlaceholderSource(cloningState.sources);
          if (emptyPlaceholder) {
            dispatch(deleteSourceAndItsChildren(emptyPlaceholder.id));
          }
          for (let i = 0; i < sources.length; i += 1) {
            dispatch(addSourceAndItsOutputSequence({ source: sources[i], sequence: sequences[i] }));
          }
          warnings.forEach((warning) => addAlert({ message: warning, severity: 'warning' }));
        });
      } catch (e) {
        console.error(e);
        addAlert({
          message: e.message,
          severity: 'error',
        });
      }
    };
    processFileSubmission();
  }, [fileList]);
  return (
    <>
      {fileLoaderFunctions && <HistoryLoadedDialog fileLoaderFunctions={fileLoaderFunctions} />}
      {children}
    </>
  );
}

export default LoadCloningHistoryWrapper;
