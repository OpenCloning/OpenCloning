import { jsonToGenbank } from '@teselagen/bio-parsers';
import useValidateState from './useValidateState';
import { convertToTeselaJson, parseHistoryFile } from '@opencloning/utils/readNwrite';
import { getIdsOfSequencesWithoutChildSource } from '@opencloning/store/cloning_utils';
import useCloningHistoryLoader from './useCloningHistoryLoader';
import useDatabase from './useDatabase';
import { useStore } from 'react-redux';

export default function useLoadDatabaseFile({ source, sendSourceRequest, setHistoryFileError }) {
  const validateState = useValidateState();
  const store = useStore();
  const database = useDatabase();
  const { applyCloningStrategy } = useCloningHistoryLoader();

  const loadDatabaseFile = async (file, databaseId, ancestors = false) => {
    if (file.name.endsWith('.json')) {
      let cloningStrategy;
      try {
        ({ cloningStrategy } = await parseHistoryFile(file));
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
        databasePrimers.forEach((databasePrimer, index) => {
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
      } catch (e) {
        console.error(e);
        setHistoryFileError(e.message);
        return;
      }
      const prevState = store.getState().cloning;
      const { backendVersion, schemaVersion, frontendVersion } = prevState.appInfo;
      cloningStrategy.backend_version = backendVersion;
      cloningStrategy.schema_version = schemaVersion;
      cloningStrategy.frontend_version = frontendVersion;
      cloningStrategy = await validateState(cloningStrategy);

      try {
        await applyCloningStrategy(cloningStrategy, {
          mode: ancestors ? 'graft' : 'merge',
          source,
          onError: setHistoryFileError,
        });
      } catch {
        // Error already reported via onError; state restored in applyCloningStrategy when applicable
      }
    } else {
      const requestData = new FormData();
      requestData.append('file', file);
      const config = {
        headers: {
          'content-type': 'multipart/form-data',
        },
      };
      const modifySource = (s) => ({ ...s, database_id: databaseId });
      sendSourceRequest({ endpoint: 'read_from_file', requestData, config, source, modifySource });
    }
  };
  return { loadDatabaseFile };
}
