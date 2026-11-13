import { Save as SaveIcon, Link as LinkIcon } from '@mui/icons-material';
import GetPrimerComponent from './GetPrimerComponent';
import GetSequenceFileAndDatabaseIdComponent from './GetSequenceFileAndDatabaseIdComponent';
import GetSequencesInBulkComponent from './GetSequencesInBulkComponent';
import { openCloningDBHttpClient } from './common';
import endpoints from './endpoints';
import LoadHistoryComponent from './LoadHistoryComponent';
import SubmitToDatabaseComponent from './SubmitToDatabaseComponent';
import SubmitCloningStrategiesInBulkComponent from './SubmitCloningStrategiesInBulkComponent';
import PrimersNotInDatabaseComponent from './PrimersNotInDatabaseComponent';

function isSubmissionDataValid(submissionData) {
  return Boolean(submissionData.title);
}

async function submitSequenceToDatabase({ submissionData, substate, id }) {
  // const substateCopy = cloneDeep(substate);
  // const selectedSequence = substateCopy.sequences.find((s) => s.id === id);
  // selectedSequence.name = submissionData.title;
  // substateCopy.description = '';
  // console.log(substateCopy);
  const { sources, primers, sequences } = substate;
  const { data } = await openCloningDBHttpClient.post(endpoints.postSequence, { sources, primers, sequences });

  const primerIds = new Set(primers.map((p) => p.id));
  const sequenceIds = new Set(sequences.map((s) => s.id));

  const primerMappings = data.mappings.filter(({localId}) => primerIds.has(localId));
  const sequenceMappings = data.mappings.filter(({localId}) => sequenceIds.has(localId));

  return { databaseId: data.id, primerMappings, sequenceMappings };
}

async function getPrimer(databaseId) {
  const response = await openCloningDBHttpClient.get(endpoints.primer(databaseId));
  return { name: response.data.name, database_id: databaseId, sequence: response.data.sequence };
}

async function submitPrimerToDatabase({ submissionData, primer }) {
  const payload = {
    name: submissionData.title,
    sequence: primer.sequence,
  };
  const response = await openCloningDBHttpClient.post(endpoints.postPrimer, payload);
  return response.data.id;
}

async function submitSequencingFileToDatabase({ databaseId, sequencingFiles }) {
  const formData = new FormData();
  sequencingFiles.forEach((file) => {
    if (file) {
      formData.append('files', file);
    }
  });

  try {
    const resp = await openCloningDBHttpClient.post(
      endpoints.sequenceSequencingFiles(databaseId),
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return resp.data;
  } catch (e) {
    console.error(e);
    throw new Error(e.response?.data?.detail || e.message || 'Error submitting sequencing files', { cause: e });
  }
}

/**
 * A sequencing file { id, name, getFile } from its reference in the API ({ id, original_name }),
 * getFile is async and downloads the file content (as a File).
 */
export function sequencingFileFromRef({ id, original_name: name }) {
  return {
    id,
    name,
    getFile: async () => {
      const downloadResp = await openCloningDBHttpClient.get(endpoints.sequencingFileDownload(id), {
        responseType: 'blob',
      });
      return new File([downloadResp.data], name);
    },
  };
}

async function getSequencingFiles(databaseId) {
  // Returns array of { id, name, getFile } where getFile is async and returns the file content
  try {
    const resp = await openCloningDBHttpClient.get(endpoints.sequenceSequencingFiles(databaseId));
    return (resp.data || []).map(sequencingFileFromRef);
  } catch (e) {
    console.error(e);
    throw new Error(e.response?.data?.detail || e.message || 'Error getting sequencing files', { cause: e });
  }
}

async function locateSequenceInDatabase(sequence) {
  const response = await openCloningDBHttpClient.post(endpoints.sequenceSearch, sequence);
  return response.data;
}

export default {
  // Name of the database interface
  name: 'OpenCloningDB',
  // Returns a link to the sequence in the database
  getSequenceLink: (databaseId) => `sequences/${databaseId}`,
  // Returns a link to the primer in the database
  getPrimerLink: (databaseId) => `primers/${databaseId}`,
  // Component for selecting and loading sequence files from the database
  GetSequenceFileAndDatabaseIdComponent,
  // Component for selecting and loading primers from the database
  GetPrimerComponent,
  // Component for submitting resources to the database
  SubmitToDatabaseComponent,
  // Component for handling primers not yet in database
  PrimersNotInDatabaseComponent,
  // Function to submit a primer to the database
  submitPrimerToDatabase,
  // Function to submit a sequence and its history to the database
  submitSequenceToDatabase,
  // Function to validate submission data
  isSubmissionDataValid,
  // Icon displayed on the node corner to submit
  SubmitIcon: SaveIcon,
  // Icon displayed on the node corner for entities in the database
  DatabaseIcon: LinkIcon,
  // OPTIONAL =======================================================================
  // Component for loading history from the database (can be hook-like does not have to render anything)
  LoadHistoryComponent,
  // Function to load sequences from url parameters
  loadSequenceFromUrlParams: () => {},
  // Function to get the primer ({name, database_id, sequence}) from the database
  getPrimer,
  // Function to get the name of a sequence from the database
  getSequenceName: () => {},
  // Function to get the sequencing files from the database, see docs for what the return value should be
  getSequencingFiles,
  // Autoload sequencing files (Boolean)
  autoloadSequencingFiles: true,
  // Omit unsaved intermediates disclaimer (Boolean)
  omitUnsavedIntermediatesDisclaimer: true,
  // Function to locate a sequence in the database
  locateSequenceInDatabase,
  // Function to submit sequencing files to the database
  submitSequencingFileToDatabase,
  // Component for loading several sequences at once (e.g. in the assembler), calls
  // onSequencesLoaded with an array of { databaseId, name, textFileSequence }
  GetSequencesInBulkComponent,
  // Dialog for submitting several cloning strategies at once (e.g. the assembler products), receives
  // { files, onClose, onSuccess }, where files is an array of File (cloning strategy JSON)
  SubmitCloningStrategiesInBulkComponent,
};
