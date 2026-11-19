import React from 'react';
import { useStore } from 'react-redux';
import useCloningAlerts from '../hooks/useCloningAlerts';
import useCloningHistoryLoader from '../hooks/useCloningHistoryLoader';
import HistoryLoadedDialog from './HistoryLoadedDialog';
import useLoadingTask from '../hooks/useLoadingTask';

function LoadCloningHistoryWrapper({ fileList, clearFiles, children }) {
  const { addAlert } = useCloningAlerts();
  const store = useStore();
  const { loadHistoryFromFile, loadSequenceFiles, loadSnapgeneHistory } = useCloningHistoryLoader();
  const [fileLoaderFunctions, setFileLoaderFunctions] = React.useState(null);
  const withLoading = useLoadingTask();

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
        const validated = await loadHistoryFromFile(files[0]);
        if (!validated) {
          return;
        }

        const errorWrapper = (fn) => async () => {
          try {
            await fn();
          } catch {
            // Error already reported by applyCloningStrategy, which restores the previous state
          }
        };
        // If there are no sequences in the cloning state, load the history file
        if (cloningState.sequences.length === 0) {
          await errorWrapper(validated.replace)();
        } else {
          setFileLoaderFunctions({
            addState: errorWrapper(validated.merge),
            replaceState: errorWrapper(validated.replace),
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
      // Errors are reported by loadSequenceFiles
      await loadSequenceFiles(files);
    };
    withLoading(processFileSubmission, 'Loading files...');
  }, [fileList]);
  return (
    <>
      {fileLoaderFunctions && <HistoryLoadedDialog fileLoaderFunctions={fileLoaderFunctions} />}
      {children}
    </>
  );
}

export default LoadCloningHistoryWrapper;
