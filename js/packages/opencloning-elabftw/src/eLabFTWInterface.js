import { Save as SaveIcon, Link as LinkIcon } from '@mui/icons-material';
import GetSequenceFileAndDatabaseIdComponent from './GetSequenceFileAndDatabaseIdComponent';
import SubmitToDatabaseComponent from './SubmitToDatabaseComponent';
import PrimersNotInDatabaseComponent from './PrimersNotInDatabaseComponent';
import GetPrimerComponent from './GetPrimerComponent';
import { eLabFTWHttpClient, writeHeaders, readHeaders, baseUrl, getELabFTWVersion } from './common';
import { getFileFromELabFTW, error2String } from './utils';
import LoadHistoryComponent from './LoadHistoryComponent';
import { encodePathSegment } from '@opencloning/utils/urlUtils';

async function deleteResource(resourceId) {
  const url = `/api/v2/items/${encodePathSegment(resourceId)}`;
  // eLabFTW requires application/json for delete requests, axios seems to require a data field for it to work
  const resp = await eLabFTWHttpClient.delete(url, { data: {}, headers: { ...writeHeaders, 'Content-Type': 'application/json' } });
  return resp.data;
}

const linkToParent = async (childId, parentId) => {
  await eLabFTWHttpClient.post(
    `/api/v2/items/${encodePathSegment(childId)}/items_links/${encodePathSegment(parentId)}`,
    {},
    { headers: writeHeaders },
  );
};

const createResource = async (categoryId) => {
  const eLabFTWVersion = await getELabFTWVersion();
  const categoryKey = 'template';
  const createdItemResponse = await eLabFTWHttpClient.post(
    '/api/v2/items',
    {
      [categoryKey]: categoryId,
    },
    { headers: writeHeaders },
  );
  return Number(createdItemResponse.headers.location.split('/').pop());
};

const patchResource = async (resourceId, title, metadata = undefined) => eLabFTWHttpClient.patch(
  `/api/v2/items/${encodePathSegment(resourceId)}`,
  { title, ...(metadata !== undefined && { metadata }) },
  { headers: writeHeaders },
);

async function submitPrimerToDatabase({ submissionData: { title, categoryId }, primer, linkedSequenceId = null }) {
  let resourceId;
  try {
    resourceId = await createResource(categoryId);
  } catch (e) {
    console.error(e);
    throw new Error(`Error creating primer: ${error2String(e)}`);
  }
  const metadata = JSON.stringify({ extra_fields: { sequence: { type: 'text', value: primer.sequence, group_id: null } } });
  let stage;
  try {
    stage = 'naming primer';
    await patchResource(resourceId, title, metadata);
    if (linkedSequenceId) {
      stage = 'linking to sequence';
      await linkToParent(linkedSequenceId, resourceId);
    }
  } catch (e) {
    console.error(e);
    try {
      await deleteResource(resourceId);
    } catch (e2) {
      console.error(e2);
      throw new Error(`There was an error (${error2String(e2)}) while trying to delete primer with id ${resourceId} after an error ${stage}.`);
    }
    throw new Error(`Error ${stage}: ${error2String(e)}`);
  }
  return resourceId;
}

async function uploadTextFileToResource(resourceId, fileName, textContent, comment) {
  const blob = new Blob([textContent], { type: 'text/plain' });
  const formData = new FormData();
  formData.append('file', blob, fileName);
  formData.append('comment', comment);
  const response = await eLabFTWHttpClient.post(`/api/v2/items/${encodePathSegment(resourceId)}/uploads`, formData, { headers: writeHeaders });
  return Number(response.headers.location.split('/').pop());
}

async function submitSequenceToDatabase({ submissionData: { title, categoryId, primerCategoryId }, substate, id }) {
  /**
   * Submit a sequence to eLabFTW database
   * @param {Object} params - The parameters object
   * @param {Object} params.submissionData - Data needed for submission
   * @param {string} params.submissionData.title - Title of the sequence
   * @param {number} params.submissionData.categoryId - Category ID in eLabFTW
   * @param {Object} params.substate - The substate containing sequence data
   * @param {Array} params.substate.sources - Array of source objects
   * @param {Array} params.substate.primers - Array of primer objects
   * @param {Array} params.substate.sequences - Array of sequence objects
   * @param {string} params.id - ID of the sequence to submit
   * @returns {Promise<Object>}
   */

  const { sources, primers, sequences, appInfo } = substate;
  const { backendVersion, schemaVersion, frontendVersion } = appInfo;

  const sequence2export = sequences.find((e) => e.id === id);
  const parentSource = sources.find((s) => s.id === id);
  if (parentSource.database_id) {
    throw new Error('Sequence already has a database_id');
  }
  // Get ancestor sources that are database sources to link to the sequence
  const parentDatabaseSources = sources.filter((source) => source.database_id);
  const parentResourceIds = parentDatabaseSources.map((source) => source.database_id);
  const primerIds = primers.map((p) => p.id);

  // Link and/or add used primers
  const newPrimersToSave = [];
  const existingPrimersToLink = primers.filter((p) => primerIds.includes(p.id) && p.database_id).map((p) => p.database_id);
  if (primerCategoryId) {
    newPrimersToSave.push(...primers.filter((p) => primerIds.includes(p.id) && !p.database_id));
  }

  // Create and name the resource
  let resourceId;
  try {
    resourceId = await createResource(categoryId);
  } catch (e) {
    console.error(e);
    throw new Error(`Error creating resource: ${error2String(e)}`);
  }
  let stage;
  let newPrimerDatabaseIds = [];
  try {
    // Patch the resource with the title
    stage = 'setting resource title';
    await patchResource(resourceId, title);

    // Add the links to parent Resources
    stage = 'linking to parent resources';
    await Promise.all(parentResourceIds.map((parentId) => linkToParent(resourceId, parentId)));

    // Add the links to the existing primers
    stage = 'linking to existing primers';
    await Promise.all(existingPrimersToLink.map((primerId) => linkToParent(resourceId, primerId)));

    // Add the new primers to the database and link them to the resource
    stage = 'submitting new primers';
    newPrimerDatabaseIds = await Promise.all(newPrimersToSave.map((primer) => submitPrimerToDatabase({ submissionData: { title: primer.name, categoryId: primerCategoryId }, primer, linkedSequenceId: resourceId })));
    const primerMappings = newPrimerDatabaseIds.map((databaseId, index) => ({ databaseId, localId: newPrimersToSave[index].id }));

    // Deep-copy primers and update the primers with the database IDs before storing the history
    const primersCopy = primers.map((p) => ({ ...p }));
    primerMappings.forEach(({ databaseId: dbId, localId }) => {
      primersCopy.find((p) => p.id === localId).database_id = dbId;
    });

    const cloningStrategy = {
      sources,
      primers: primersCopy,
      sequences,
      backend_version: backendVersion,
      schema_version: schemaVersion,
      frontend_version: frontendVersion,
    };

    // Add the sequence and history files to the resource
    stage = 'uploading sequence file';
    await uploadTextFileToResource(resourceId, `${title}.gb`, sequence2export.file_content, 'resource sequence - generated by OpenCloning');
    stage = 'uploading history file';
    await uploadTextFileToResource(resourceId, `${title}_history.json`, JSON.stringify(cloningStrategy), 'history file - generated by OpenCloning');
    // Format output values
    return { primerMappings, databaseId: resourceId };
  } catch (e) {
    console.error(e);
    let primersDeleted = false;
    try {
      await Promise.all(newPrimerDatabaseIds.map(deleteResource));
      primersDeleted = true;
      await deleteResource(resourceId);
    } catch (e2) {
      console.error(e2);
      if (primersDeleted) {
        throw new Error(`There was an error (${error2String(e2)}) while trying to delete the sequence with id ${resourceId} after an error ${stage}.`);
      }
      throw new Error(`There was an error (${error2String(e2)}) while trying to delete newly created primers linked to sequence with id ${resourceId} after an error ${stage}.`);
    }
    throw new Error(`Error ${stage}: ${error2String(e)}`);
  }
}

function isSubmissionDataValid(submissionData) {
  // This function is necessary because you might be setting submissionData from multiple components
  return Boolean(submissionData.title && submissionData.categoryId);
}

async function loadSequenceFromUrlParams(urlParams) {
  const { item_id: itemId, file_id: fileId } = urlParams;

  if (itemId && fileId) {
    const url = `/api/v2/items/${encodePathSegment(itemId)}/uploads/${encodePathSegment(fileId)}`;
    let fileInfo;
    try {
      const resp = await eLabFTWHttpClient.get(url, { headers: readHeaders });
      fileInfo = resp.data;
    } catch (e) {
      throw new Error(`${error2String(e)}`);
    }

    // getFileFromELabFTW already handles errors
    const file = await getFileFromELabFTW(itemId, fileInfo);
    return { file, databaseId: itemId };
  }
  return null;
}

async function getPrimer(databaseId) {
  const url = `/api/v2/items/${encodePathSegment(databaseId)}`;
  try {
    const resp = await eLabFTWHttpClient.get(url, { headers: readHeaders });
    resp.data.metadata = JSON.parse(resp.data.metadata);
    return { name: resp.data.title, database_id: databaseId, sequence: resp.data.metadata.extra_fields.sequence?.value };
  } catch (e) {
    console.error(e);
    if (e.code === 'ERR_NETWORK') {
      throw new Error(`Error getting primer: ${error2String(e)}`);
    }
    throw new Error(`Error getting primer with id ${databaseId}, it might have been deleted or you can no longer access it`);
  }
}

async function getSequenceName(databaseId) {
  const url = `/api/v2/items/${encodePathSegment(databaseId)}`;
  try {
    const resp = await eLabFTWHttpClient.get(url, { headers: readHeaders });
    return resp.data.title;
  } catch (e) {
    console.error(e);
    if (e.code === 'ERR_NETWORK') {
      throw new Error(`Error getting sequence name: ${error2String(e)}`);
    }
    throw new Error(`Error getting name of sequence with id ${databaseId}, it might have been deleted or you can no longer access it`);
  }
}

async function getSequencingFiles(databaseId) {
  // This function should return an array of objects:
  // name: the name of the file
  // getFile: an async function that returns the file content
  const url = `/api/v2/items/${encodePathSegment(databaseId)}/uploads`;
  try {
    const resp = await eLabFTWHttpClient.get(url, { headers: readHeaders });
    return resp.data.map((fileInfo) => ({
      name: fileInfo.real_name,
      getFile: async () => getFileFromELabFTW(databaseId, fileInfo),
    }));
  } catch (e) {
    console.error(e);
    throw new Error(`${error2String(e)}`);
  }
}

export default {
  // Name of the database interface
  name: 'eLabFTW',
  // Returns a link to the sequence in the database
  getSequenceLink: (databaseId) => `${baseUrl}/database.php?mode=view&id=${databaseId}`,
  // Returns a link to the primer in the database
  getPrimerLink: (databaseId) => `${baseUrl}/database.php?mode=view&id=${databaseId}`,
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
  // Icon displayed on the node corner for sequences in the database
  DatabaseIcon: LinkIcon,
  // OPTIONAL =======================================================================
  // Component for loading history from the database (can be hook-like does not have to render anything)
  LoadHistoryComponent,
  // Function to load sequences from url parameters
  loadSequenceFromUrlParams,
  // Function to get the primer ({name, database_id, sequence}) from the database
  getPrimer,
  // Function to get the name of a sequence from the database
  getSequenceName,
  // Function to get the sequencing files from the database, see docs for what the return value should be
  getSequencingFiles,
};
