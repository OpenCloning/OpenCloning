import { jsonToGenbank } from '@teselagen/bio-parsers';
import {
  convertToTeselaJson,
  fileUploadRequest,
  fillMissingVersions,
  parseHistoryFile,
} from '@opencloning/utils/readNwrite';
import { getIdsOfSequencesWithoutChildSource } from '@opencloning/store/cloning_utils';
import useCloningHistoryLoader from './useCloningHistoryLoader';
import useDatabase from './useDatabase';
import useLoadingTask from './useLoadingTask';
import { useStore } from 'react-redux';

/**
 * Load a file from the database: a history file (.json) is merged into the cloning state (or grafted,
 * with ancestors=true), any other file is read as a sequence. If sendSourceRequest is given, the sequence
 * is the output of source (so the source shows the loading state), otherwise it is added as a new source.
 */
export default function useLoadDatabaseFile({ source, sendSourceRequest, setHistoryFileError }) {
  const store = useStore();
  const database = useDatabase();
  const { validateCloningStrategy, loadSequenceFiles } = useCloningHistoryLoader();
  const withLoading = useLoadingTask();

  // Adapt a cloning strategy from the database to the sequences and primers of the database
  const adaptToDatabase = async (cloningStrategy, databaseId) => {
    // If the cloning strategy should end on a single sequence, set the databaseId for the right source
    const terminalSequences = getIdsOfSequencesWithoutChildSource(cloningStrategy.sources, cloningStrategy.sequences);
    if (terminalSequences.length === 1) {
      const lastSource = cloningStrategy.sources.find((s) => s.id === terminalSequences[0]);
      lastSource.database_id = databaseId;
    }
    // When importing sources that had inputs that we don't want to load, we turn them into database sources
    const allSequenceIds = [...cloningStrategy.sequences.map((e) => e.id), ...cloningStrategy.primers.map((e) => e.id)];
    cloningStrategy.sources = cloningStrategy.sources.map((s) => {
      if (s.input.some(({ sequence }) => !allSequenceIds.includes(sequence))) {
        return { id: s.id, type: 'DatabaseSource', input: [], database_id: s.database_id };
      }
      return s;
    });

    // Get primer names (in case they have changed with respect to what was in the file)
    // and verify that the sequence of the primer in the database is the same as the sequence in the cloning strategy
    const primerDatabaseIds = cloningStrategy.primers.filter((p) => p.database_id).map((p) => p.database_id);
    const databasePrimers = await Promise.all(primerDatabaseIds.map(database.getPrimer));
    databasePrimers.forEach((databasePrimer) => {
      const primerInCloningStrategy = cloningStrategy.primers.find((p) => p.database_id === databasePrimer.database_id);
      primerInCloningStrategy.name = databasePrimer.name;
      if (primerInCloningStrategy.sequence !== databasePrimer.sequence) {
        throw new Error(`The sequence of primer ${primerInCloningStrategy.name} (${primerInCloningStrategy.database_id}) conflicts with the sequence in the database`);
      }
    });

    // Get the sequence name from the database and update the cloning strategy with it if it is different
    await Promise.all(cloningStrategy.sources.filter((s) => s.database_id).map(async (cloningSource) => {
      const seqDatabaseId = cloningSource.database_id;
      const sequence = cloningStrategy.sequences.find((e) => e.id === cloningSource.id);
      const seq = convertToTeselaJson(sequence);
      const databaseName = await database.getSequenceName(seqDatabaseId);
      if (databaseName && (seq.name !== databaseName)) {
        seq.name = databaseName;
        const genbank = jsonToGenbank(seq);
        sequence.file_content = genbank;
        // Maybe this is unnecessary
        cloningSource.output_name = databaseName;
      }
    }));
  };

  const loadHistoryFile = async (file, databaseId, ancestors) => {
    let cloningStrategy;
    try {
      ({ cloningStrategy } = await parseHistoryFile(file));
      await adaptToDatabase(cloningStrategy, databaseId);
    } catch (e) {
      console.error(e);
      setHistoryFileError(e.message);
      return;
    }
    // Cloning strategies built in the app from a database sequence have no versions. The versions of
    // history files are kept, so that the backend migrates old ones.
    cloningStrategy = fillMissingVersions(cloningStrategy, store.getState().cloning.appInfo);

    const validated = await validateCloningStrategy(cloningStrategy, { onError: setHistoryFileError });
    if (!validated) {
      return;
    }
    try {
      const applyOptions = { source, onError: setHistoryFileError };
      await (ancestors ? validated.graft(applyOptions) : validated.merge(applyOptions));
    } catch {
      // Error already reported via onError; state restored in applyCloningStrategy when applicable
    }
  };

  const loadDatabaseFile = async (file, databaseId, ancestors = false) => {
    // History files are fetched/validated here, so block the UI.
    if (file.name.endsWith('.json')) {
      return withLoading(() => loadHistoryFile(file, databaseId, ancestors), 'Loading from database...');
    }
    const modifySource = (s) => ({ ...s, database_id: databaseId });
    // Sequence files go through sendSourceRequest, which shows its own loading state in the source.
    if (sendSourceRequest) {
      const { requestData, config } = fileUploadRequest(file);
      return sendSourceRequest({ endpoint: 'read_from_file', requestData, config, source, modifySource });
    }
    // Without a source component (e.g. loading from the url), add the sequence as a new source
    return withLoading(
      () => loadSequenceFiles([file], { modifySource, onError: setHistoryFileError }),
      'Loading from database...',
    );
  };
  return { loadDatabaseFile };
}
