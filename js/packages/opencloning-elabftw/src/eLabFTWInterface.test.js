import { it, vi } from 'vitest';
import { isEqual, cloneDeep } from 'lodash-es';
import eLabFTWInterface from './eLabFTWInterface';
import { makeSequenceMetadata } from './common';
import { error2String } from './utils';

const {
  name,
  getSequenceLink,
  getPrimerLink,
  submitPrimerToDatabase,
  getPrimer,
  getSequenceName,
  getSequencingFiles,
  loadSequenceFromUrlParams,
  isSubmissionDataValid,
  submitSequenceToDatabase,
} = eLabFTWInterface;

let uniqueId = 2;
const getUniqueId = () => uniqueId++;

// bunch of constants for testing
const MAIN_RESOURCE_DATABASE_ID = getUniqueId();
const MAIN_RESOURCE_CATEGORY_ID = getUniqueId();
const MAIN_RESOURCE_TITLE = 'main-resource-title';

const MAIN_RESOURCE_SEQUENCE_FILE_DATABASE_ID = getUniqueId();
const MAIN_RESOURCE_SEQUENCE_FILE_NAME = 'sequence-file-1';
const MAIN_RESOURCE_SEQUENCE_FILE_CONTENT = 'sequence-file-content-1';

const MAIN_RESOURCE_HISTORY_FILE_DATABASE_ID = getUniqueId();
const HISTORY_FILE_INTERNAL_SEQUENCE_ID = getUniqueId();
const HISTORY_FILE_INTERNAL_PRIMER_ID1 = getUniqueId();
const HISTORY_FILE_INTERNAL_PRIMER_ID2 = getUniqueId();
const HISTORY_FILE_ANCESTOR_INTERNAL_SEQUENCE_ID = getUniqueId();
const HISTORY_FILE_ANCESTOR_DATABASE_ID = getUniqueId();
const HISTORY_FILE_INTERNAL_SOURCE_ID = HISTORY_FILE_INTERNAL_SEQUENCE_ID;
const HISTORY_FILE_ANCESTOR_INTERNAL_SOURCE_ID = getUniqueId();
// const

const SECONDARY_RESOURCE_DATABASE_ID1 = getUniqueId();
const SECONDARY_RESOURCE_DATABASE_ID2 = getUniqueId();
const SECONDARY_RESOURCE_CATEGORY_ID = getUniqueId();
const SEQUENCING_FILE_DATABASE_ID1 = getUniqueId();
const SEQUENCING_FILE_DATABASE_ID2 = getUniqueId();
const SEQUENCING_FILE_NAME1 = 'sequencing-file-1';
const SEQUENCING_FILE_NAME2 = 'sequencing-file-2';
const SEQUENCING_FILE_CONTENT1 = 'sequencing-file-content-1';
const SEQUENCING_FILE_CONTENT2 = 'sequencing-file-content-2';

const PRIMER1_NAME = 'primer1';
const PRIMER1_SEQUENCE = 'ACGT';
const PRIMER2_NAME = 'primer2';
const PRIMER2_SEQUENCE = 'AAAA';

// For testing purposes, we need an empty metadata object
export const emptyMetadata = JSON.stringify({ extra_fields: {} });

// Get the text content of a Blob
const getFileText = async (file) => {
  const reader = new FileReader();
  return new Promise((resolve) => {
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.readAsText(file);
  });
};

// Take a scenario and return a new scenario with a network error
const mockNetworkError = (scenario) => ({
  ...scenario,
  code: 'ERR_NETWORK',
  response: undefined,
});

// Take a scenario and return a new scenario with a not found error
const mockNotFound = (scenario) => ({
  ...scenario,
  response: { status: 403, data: { description: 'Not found' } },
  code: 'hello',
});

// Mock the envValues module
vi.mock('./envValues', () => ({
  readApiKey: '',
  writeApiKey: '',
  baseUrl: '',
}));

// Mock the component imports
vi.mock('@mui/icons-material/Save', () => ({ default: 'SaveIcon' }));
vi.mock('@mui/icons-material/Link', () => ({ default: 'LinkIcon' }));
vi.mock('./GetSequenceFileAndDatabaseIdComponent', () => ({ default: 'GetSequenceFileAndDatabaseIdComponent' }));
vi.mock('./SubmitToDatabaseComponent', () => ({ default: 'SubmitToDatabaseComponent' }));
vi.mock('./PrimersNotInDatabaseComponent', () => ({ default: 'PrimersNotInDatabaseComponent' }));
vi.mock('./GetPrimerComponent', () => ({ default: 'GetPrimerComponent' }));
vi.mock('./LoadHistoryComponent', () => ({ default: 'LoadHistoryComponent' }));

// mockedScenarios is an array that contains mock API requests combined
// with their responses, for instance:
// [
//   {
//     method: 'get',
//     url: '/api/v2/items/1',
//     response: { data: { id: 1, title: 'test' } },
//   },
// ]
// If a request is received by the mock client where the method, url and data
// match one of the scenarios, the response from the scenario is returned. Otherwise,
// the request will fail with an error. At the end of each test, we check that all
// scenarios were used and fail it otherwise. Scenarios are removed from the array
// when they are used, so they are not used twice.

let mockedScenarios;

beforeEach(() => {
  mockedScenarios = [];
});

afterEach(() => {
  // Check that all scenarios were used

  if (mockedScenarios.length > 0) {
    console.log('> mockedScenarios not used');
    console.log(mockedScenarios);
  }
  expect(mockedScenarios).toHaveLength(0);
});

// Get a scenario from the mockedScenarios array
async function getScenario(method, url, data, config) {
  const nextScenario = mockedScenarios.shift();
  expect(nextScenario).toBeDefined();
  expect({ method: nextScenario.method, url: nextScenario.url, config: nextScenario.config }).toEqual({ method, url, config });

  if (nextScenario.data instanceof FormData || data instanceof FormData) {
    expect(data).toBeInstanceOf(FormData);
    expect(nextScenario.data).toBeInstanceOf(FormData);

    const scenarioComment = nextScenario.data.get('comment');
    const requestComment = data.get('comment');
    expect(scenarioComment).toBe(requestComment);

    const scenarioFile = nextScenario.data.get('file');
    const requestFile = data.get('file');
    const scenarioFileText = await getFileText(scenarioFile);
    const requestFileText = await getFileText(requestFile);
    const filesAreJson = scenarioFileText.startsWith('{') && requestFileText.startsWith('{');
    if (filesAreJson) {
      const scenarioHistory = JSON.parse(scenarioFileText);
      const requestHistory = JSON.parse(requestFileText);
      expect(isEqual(scenarioHistory, requestHistory)).toBe(true);
    } else if (scenarioFileText !== requestFileText) {
      expect(scenarioFileText).toBe(requestFileText);
    }
  } else {
    expect(data).toEqual(nextScenario.data);
  }
  return nextScenario;
}

// Common function to mock requests of a given method
function requestMocker(method) {
  return async (...args) => {
    let url;
    let data;
    let config;
    if (method === 'get') {
      [url, config] = args;
      data = undefined;
    } else if (method === 'delete') {
      [url, config] = args;
      data = config.data;
      config = { headers: config.headers };
    } else {
      [url, data, config] = args;
    }
    const scenario = await getScenario(method, url, data, config);
    expect(scenario).toBeDefined();
    if (scenario.code === undefined && (scenario.response.status === undefined || scenario.response.status === 200)) {
      return Promise.resolve(scenario.response);
    }
    return Promise.reject(scenario);
  };
}

// Mock the eLabFTWHttpClient module
vi.mock('./common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    eLabFTWHttpClient: {
      post: requestMocker('post'),
      patch: requestMocker('patch'),
      get: requestMocker('get'),
      delete: requestMocker('delete'),
    },
    getELabFTWVersion: () => Promise.resolve(50200),
  };
});

describe('test name and links', () => {
  it('test name', () => {
    expect(name).toBe('eLabFTW');
  });
  it('test getSequenceLink', () => {
    expect(getSequenceLink(1)).toBe('/database.php?mode=view&id=1');
  });
  it('test getPrimerLink', () => {
    expect(getPrimerLink(1)).toBe('/database.php?mode=view&id=1');
  });
});

const mockCreateResource = {
  method: 'post',
  url: '/api/v2/items',
  data: {
    template: MAIN_RESOURCE_CATEGORY_ID,
  },
  config: { headers: {} },
  response: { headers: { location: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}` } },
};

const mockUpdateResource = {
  method: 'patch',
  url: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}`,
  data: { title: MAIN_RESOURCE_TITLE },
  config: { headers: {} },
  response: {},
};

const mockPrimerUpdate = {
  ...mockUpdateResource,
  data: {
    title: PRIMER1_NAME,
    metadata: JSON.stringify({
      extra_fields: {
        sequence: {
          type: 'text',
          value: PRIMER1_SEQUENCE,
          group_id: null,
        },
      },
    }),
  },

};

const mockPrimerLink = {
  method: 'post',
  url: `/api/v2/items/${SECONDARY_RESOURCE_DATABASE_ID1}/items_links/${MAIN_RESOURCE_DATABASE_ID}`,
  data: {},
  config: { headers: {} },
  response: {},
};

const mockDeleteResource = {
  method: 'delete',
  url: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}`,
  data: {},
  config: { headers: {
    'Content-Type': 'application/json',
  } },
  response: {},
};

const primerSubmissionPayload = {
  submissionData: {
    title: PRIMER1_NAME,
    categoryId: MAIN_RESOURCE_CATEGORY_ID,
  },
  primer: { sequence: PRIMER1_SEQUENCE },
};
const primerSubmissionPayloadWithLinkedSequence = {
  ...primerSubmissionPayload,
  linkedSequenceId: SECONDARY_RESOURCE_DATABASE_ID1,
};

describe('test submitPrimerToDatabase', () => {
  it('without linked sequence', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockPrimerUpdate);

    const result = await submitPrimerToDatabase(primerSubmissionPayload);
    expect(result).toBe(MAIN_RESOURCE_DATABASE_ID);
  });
  it('with linked sequence', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockPrimerUpdate);
    mockedScenarios.push(mockPrimerLink);
    const result = await submitPrimerToDatabase(primerSubmissionPayloadWithLinkedSequence);
    expect(result).toBe(MAIN_RESOURCE_DATABASE_ID);
  });

  it('linking to missing sequence', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockPrimerUpdate);
    mockedScenarios.push(mockNotFound(mockPrimerLink));
    mockedScenarios.push(mockDeleteResource);

    const result = submitPrimerToDatabase(primerSubmissionPayloadWithLinkedSequence);
    expect(result).rejects.toThrow('Error linking to sequence: Not found');
  });
  it('fail linking network error', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockPrimerUpdate);
    mockedScenarios.push(mockNetworkError(mockPrimerLink));
    mockedScenarios.push(mockDeleteResource);
    const result = submitPrimerToDatabase(primerSubmissionPayloadWithLinkedSequence);
    expect(result).rejects.toThrow('Error linking to sequence: Network error: Cannot connect to eLabFTW');
  });
  it('fail naming network error', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockNetworkError(mockPrimerUpdate));
    mockedScenarios.push(mockDeleteResource);
    const result = submitPrimerToDatabase(primerSubmissionPayload);
    expect(result).rejects.toThrow('Error naming primer: Network error: Cannot connect to eLabFTW');
  });
  it('fail creating primer', async () => {
    mockedScenarios.push(mockNetworkError(mockCreateResource));
    const result = submitPrimerToDatabase(primerSubmissionPayload);
    expect(result).rejects.toThrow('Error creating primer: Network error: Cannot connect to eLabFTW');
  });
  it('fail removing primer if error occurs', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockNetworkError(mockPrimerUpdate));
    mockedScenarios.push(mockNetworkError(mockDeleteResource));
    const result = submitPrimerToDatabase(primerSubmissionPayload);
    expect(result).rejects.toThrow(`There was an error (Network error: Cannot connect to eLabFTW) while trying to delete primer with id ${MAIN_RESOURCE_DATABASE_ID} after an error naming primer.`);
  });
});

const mockPrimerGet = {
  method: 'get',
  url: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}`,
  config: { headers: {} },
  response: { data: {
    id: MAIN_RESOURCE_DATABASE_ID,
    title: PRIMER1_NAME,
    metadata: makeSequenceMetadata(PRIMER1_SEQUENCE),
  },
  },
};

const mockPrimerGetNoSequence = {
  ...mockPrimerGet,
  response: { data: {
    id: MAIN_RESOURCE_DATABASE_ID,
    title: PRIMER1_NAME,
    metadata: emptyMetadata,
  },
  },
};

describe('test getPrimer', () => {
  it('get primer', async () => {
    mockedScenarios.push(mockPrimerGet);
    const result = await getPrimer(MAIN_RESOURCE_DATABASE_ID);
    expect(result).toEqual({
      name: PRIMER1_NAME,
      database_id: MAIN_RESOURCE_DATABASE_ID,
      sequence: PRIMER1_SEQUENCE,
    });
  });
  it('primer with no sequence does not raise an error when loading', async () => {
    mockedScenarios.push(mockPrimerGetNoSequence);
    const result = await getPrimer(MAIN_RESOURCE_DATABASE_ID);
    expect(result).toEqual({
      name: PRIMER1_NAME,
      database_id: MAIN_RESOURCE_DATABASE_ID,
    });
  });
  it('fail getting primer - network error', async () => {
    mockedScenarios.push(mockNetworkError(mockPrimerGet));
    const result = getPrimer(MAIN_RESOURCE_DATABASE_ID);
    expect(result).rejects.toThrow('Error getting primer: Network error: Cannot connect to eLabFTW');
  });
  it('fail getting primer - not found', async () => {
    mockedScenarios.push(mockNotFound(mockPrimerGet));
    const result = getPrimer(MAIN_RESOURCE_DATABASE_ID);
    expect(result).rejects.toThrow(`Error getting primer with id ${MAIN_RESOURCE_DATABASE_ID}, it might have been deleted or you can no longer access it`);
  });
});

const mockSequenceName = {
  method: 'get',
  url: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}`,
  config: { headers: {} },
  response: { data: { id: MAIN_RESOURCE_DATABASE_ID, title: MAIN_RESOURCE_TITLE } },
};

describe('test getSequenceName', () => {
  it('get sequence name', async () => {
    mockedScenarios.push(mockSequenceName);
    const result = await getSequenceName(MAIN_RESOURCE_DATABASE_ID);
    expect(result).toBe(MAIN_RESOURCE_TITLE);
  });
  it('fail getting sequence name - network error', async () => {
    mockedScenarios.push(mockNetworkError(mockSequenceName));
    const result = getSequenceName(MAIN_RESOURCE_DATABASE_ID);
    expect(result).rejects.toThrow('Error getting sequence name: Network error: Cannot connect to eLabFTW');
  });
  it('fail getting sequence name - not found', async () => {
    mockedScenarios.push(mockNotFound(mockSequenceName));
    const result = getSequenceName(MAIN_RESOURCE_DATABASE_ID);
    expect(result).rejects.toThrow(`Error getting name of sequence with id ${MAIN_RESOURCE_DATABASE_ID}, it might have been deleted or you can no longer access it`);
  });
});

const mockSequencingFilesFirstRequest = {
  method: 'get',
  url: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}/uploads`,
  config: { headers: {} },
  response: { data: [
    {
      id: SEQUENCING_FILE_DATABASE_ID1,
      real_name: SEQUENCING_FILE_NAME1,
    },
    {
      id: SEQUENCING_FILE_DATABASE_ID2,
      real_name: SEQUENCING_FILE_NAME2,
    },
  ] },
};
const mockSequencingFilesFirstFile = {
  method: 'get',
  url: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}/uploads/${SEQUENCING_FILE_DATABASE_ID1}?format=binary`,
  config: { headers: {}, responseType: 'blob' },
  response: { data: new Blob([SEQUENCING_FILE_CONTENT1], { type: 'application/octet-stream' }) },
};

const mockSequencingFilesSecondFile = {
  ...mockSequencingFilesFirstFile,
  url: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}/uploads/${SEQUENCING_FILE_DATABASE_ID2}?format=binary`,
  response: { data: new Blob([SEQUENCING_FILE_CONTENT2], { type: 'application/octet-stream' }) },
};

describe('test getSequencingFiles', () => {
  it('get sequencing files', async () => {
    mockedScenarios.push(mockSequencingFilesFirstRequest);
    mockedScenarios.push(mockSequencingFilesFirstFile);
    mockedScenarios.push(mockSequencingFilesSecondFile);
    const result = await getSequencingFiles(MAIN_RESOURCE_DATABASE_ID);

    expect(result[0].name).toEqual(SEQUENCING_FILE_NAME1);
    const reader = new FileReader();
    reader.onload = () => {
      expect(reader.result).toEqual(SEQUENCING_FILE_CONTENT1);
    };
    reader.readAsText(await result[0].getFile());

    expect(result[1].name).toEqual(SEQUENCING_FILE_NAME2);
    const reader2 = new FileReader();
    reader2.onload = () => {
      expect(reader2.result).toEqual(SEQUENCING_FILE_CONTENT2);
    };
    reader2.readAsText(await result[1].getFile());
  });
  it('get sequencing files - network error', async () => {
    mockedScenarios.push(mockNetworkError(mockSequencingFilesFirstRequest));
    const result = getSequencingFiles(MAIN_RESOURCE_DATABASE_ID);
    expect(result).rejects.toThrow('Network error: Cannot connect to eLabFTW');
  });
  it('get sequencing files - not found', async () => {
    mockedScenarios.push(mockNotFound(mockSequencingFilesFirstRequest));
    const result = getSequencingFiles(MAIN_RESOURCE_DATABASE_ID);
    expect(result).rejects.toThrow('Not found');
  });
  it('get sequencing files - getFile() - network error', async () => {
    mockedScenarios.push(mockSequencingFilesFirstRequest);
    mockedScenarios.push(mockNetworkError(mockSequencingFilesFirstFile));
    const result = await getSequencingFiles(MAIN_RESOURCE_DATABASE_ID);
    expect(result[0].getFile()).rejects.toThrow('Network error: Cannot connect to eLabFTW');
  });
});

const mockFileInfo = {
  method: 'get',
  url: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}/uploads/${MAIN_RESOURCE_SEQUENCE_FILE_DATABASE_ID}`,
  config: { headers: {} },
  response: { data: { id: MAIN_RESOURCE_SEQUENCE_FILE_DATABASE_ID, real_name: MAIN_RESOURCE_SEQUENCE_FILE_NAME } },
};

const mockFileContent = {
  method: 'get',
  url: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}/uploads/${MAIN_RESOURCE_SEQUENCE_FILE_DATABASE_ID}?format=binary`,
  config: { headers: {}, responseType: 'blob' },
  response: { data: new Blob([MAIN_RESOURCE_SEQUENCE_FILE_CONTENT], { type: 'application/octet-stream' }) },
};

describe('test loadSequenceFromUrlParams', () => {
  it('load sequence from url params', async () => {
    mockedScenarios.push(mockFileInfo);
    mockedScenarios.push(mockFileContent);
    const result = await loadSequenceFromUrlParams({ item_id: MAIN_RESOURCE_DATABASE_ID, file_id: MAIN_RESOURCE_SEQUENCE_FILE_DATABASE_ID });
    expect(result.file).toBeInstanceOf(File);
    expect(result.file.name).toEqual(MAIN_RESOURCE_SEQUENCE_FILE_NAME);
    expect(result.databaseId).toEqual(MAIN_RESOURCE_DATABASE_ID);
    const reader = new FileReader();
    reader.onload = () => {
      expect(reader.result).toEqual(MAIN_RESOURCE_SEQUENCE_FILE_CONTENT);
    };
    reader.readAsText(result.file);
  });
  it('load sequence from url params - no item_id or file_id', async () => {
    const result = await loadSequenceFromUrlParams({ file_id: MAIN_RESOURCE_SEQUENCE_FILE_DATABASE_ID });
    expect(result).toBeNull();
    const result2 = await loadSequenceFromUrlParams({ item_id: MAIN_RESOURCE_DATABASE_ID });
    expect(result2).toBeNull();
    const result3 = await loadSequenceFromUrlParams({});
    expect(result3).toBeNull();
  });
  it('load sequence from url params - fileInfo network error', async () => {
    mockedScenarios.push(mockNetworkError(mockFileInfo));
    const result = loadSequenceFromUrlParams({ item_id: MAIN_RESOURCE_DATABASE_ID, file_id: MAIN_RESOURCE_SEQUENCE_FILE_DATABASE_ID });
    expect(result).rejects.toThrow('Network error: Cannot connect to eLabFTW');
  });
  it('load sequence from url params - fileInfo not found', async () => {
    mockedScenarios.push(mockNotFound(mockFileInfo));
    const result = loadSequenceFromUrlParams({ item_id: MAIN_RESOURCE_DATABASE_ID, file_id: MAIN_RESOURCE_SEQUENCE_FILE_DATABASE_ID });
    expect(result).rejects.toThrow('Not found');
  });
  it('load sequence from url params - fileContent network error', async () => {
    mockedScenarios.push(mockFileInfo);
    mockedScenarios.push(mockNetworkError(mockFileContent));
    const result = loadSequenceFromUrlParams({ item_id: MAIN_RESOURCE_DATABASE_ID, file_id: MAIN_RESOURCE_SEQUENCE_FILE_DATABASE_ID });
    expect(result).rejects.toThrow('Network error: Cannot connect to eLabFTW');
  });
  it('load sequence from url params - fileContent not found', async () => {
    mockedScenarios.push(mockFileInfo);
    mockedScenarios.push(mockNotFound(mockFileContent));
    const result = loadSequenceFromUrlParams({ item_id: MAIN_RESOURCE_DATABASE_ID, file_id: MAIN_RESOURCE_SEQUENCE_FILE_DATABASE_ID });
    expect(result).rejects.toThrow('Not found');
  });
});

describe('test isSubmissionDataValid', () => {
  it('isSubmissionDataValid', () => {
    expect(isSubmissionDataValid({ title: MAIN_RESOURCE_TITLE, categoryId: MAIN_RESOURCE_CATEGORY_ID })).toBe(true);
    expect(isSubmissionDataValid({ title: MAIN_RESOURCE_TITLE })).toBe(false);
    expect(isSubmissionDataValid({ categoryId: MAIN_RESOURCE_CATEGORY_ID })).toBe(false);
  });
});

describe('test error2String', () => {
  it('error2String', () => {
    expect(error2String({
      code: 'ERR_NETWORK',
      response: { status: 500, data: { description: 'Internal server error' } },
    })).toBe('Network error: Cannot connect to eLabFTW');
    expect(error2String({
      code: 'OK',
      response: { status: 500 },
    })).toBe('Internal server error');
    expect(error2String({
      code: 'OK',
      response: { status: 404, data: { description: 'error-message' } },
    })).toBe('error-message');
    expect(error2String({
    })).toBe('Internal error, please contact the developers.');
    expect(error2String({
      code: 'OK',
      response: { status: 404, data: { description: { dummy: 'dummy' } } },
    })).toBe('Request error, please contact the developers.');
  });
});

const substate = {
  primers: [],
  sequences: [
    {
      id: HISTORY_FILE_INTERNAL_SEQUENCE_ID,
      file_content: MAIN_RESOURCE_SEQUENCE_FILE_CONTENT,
    },
  ],
  sources: [
    {
      id: HISTORY_FILE_INTERNAL_SOURCE_ID
    },
  ],
  appInfo: {
    backendVersion: '1.0.0',
    schemaVersion: '1.0.0',
    frontendVersion: '1.0.0',
  },
};

// Helper function to match the format of cloning strategy
const expandAppInfo = (originalSubstate) => {
  const newSubstate = cloneDeep(originalSubstate);
  newSubstate.backend_version = originalSubstate.appInfo.backendVersion;
  newSubstate.schema_version = originalSubstate.appInfo.schemaVersion;
  newSubstate.frontend_version = originalSubstate.appInfo.frontendVersion;
  delete newSubstate.appInfo;
  return newSubstate;
};

const substateWithPrimers = {
  ...substate,
  primers: [
    { id: HISTORY_FILE_INTERNAL_PRIMER_ID1, sequence: PRIMER1_SEQUENCE, name: PRIMER1_NAME },
    { id: HISTORY_FILE_INTERNAL_PRIMER_ID2, sequence: PRIMER2_SEQUENCE, name: PRIMER2_NAME, database_id: SECONDARY_RESOURCE_DATABASE_ID2 },
  ],
};

const substateWithAncestors = {
  ...substate,
  sequences: [
    ...substate.sequences,
    {
      id: HISTORY_FILE_ANCESTOR_INTERNAL_SEQUENCE_ID,
    },
  ],
  sources: [
    ...substate.sources,
    {
      id: HISTORY_FILE_ANCESTOR_INTERNAL_SOURCE_ID,
      database_id: HISTORY_FILE_ANCESTOR_DATABASE_ID,
    },
  ],
};

const formData = new FormData();
formData.append('file', new Blob([MAIN_RESOURCE_SEQUENCE_FILE_CONTENT], { type: 'text/plain' }));
formData.append('comment', 'resource sequence - generated by OpenCloning');

const formData2 = new FormData();
formData2.append('file', new Blob([JSON.stringify(expandAppInfo(substate))], { type: 'text/plain' }));
formData2.append('comment', 'history file - generated by OpenCloning');

const formDataWithAncestors = new FormData();
formDataWithAncestors.append('file', new Blob([JSON.stringify(expandAppInfo(substateWithAncestors))], { type: 'text/plain' }));
formDataWithAncestors.append('comment', 'history file - generated by OpenCloning');

// When the new primer is created, the history is updated with the new primer database id,
// so the submitted file must contain the new primer database id
const substateWithPrimersAndNewPrimerDatabaseId = JSON.parse(JSON.stringify(expandAppInfo(substateWithPrimers)));
substateWithPrimersAndNewPrimerDatabaseId.primers[0].database_id = SECONDARY_RESOURCE_DATABASE_ID1;
const formDataWithPrimers = new FormData();
formDataWithPrimers.append('file', new Blob([JSON.stringify(substateWithPrimersAndNewPrimerDatabaseId)], { type: 'text/plain' }));
formDataWithPrimers.append('comment', 'history file - generated by OpenCloning');

const mockUploadSequenceFile = {
  method: 'post',
  url: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}/uploads`,
  data: formData,
  config: { headers: {} },
  response: { headers: { location: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}/uploads/${MAIN_RESOURCE_SEQUENCE_FILE_DATABASE_ID}` } },
};
const mockUploadHistoryFile = {
  method: 'post',
  url: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}/uploads`,
  data: formData2,
  config: { headers: {} },
  response: { headers: { location: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}/uploads/${MAIN_RESOURCE_HISTORY_FILE_DATABASE_ID}` } },
};

const mockUploadHistoryFileWithPrimers = {
  ...mockUploadHistoryFile,
  data: formDataWithPrimers,
};

const mockUploadHistoryFileWithAncestors = {
  ...mockUploadHistoryFile,
  data: formDataWithAncestors,
};

const submissionPayload = {
  submissionData: { title: MAIN_RESOURCE_TITLE, categoryId: MAIN_RESOURCE_CATEGORY_ID },
  substate,
  id: HISTORY_FILE_INTERNAL_SEQUENCE_ID,
};

const submissionPayloadWithPrimers = {
  ...submissionPayload,
  submissionData: {
    ...submissionPayload.submissionData,
    primerCategoryId: SECONDARY_RESOURCE_CATEGORY_ID,
  },
  substate: substateWithPrimers,
};

const submissionPayloadWithAncestors = {
  ...submissionPayload,
  substate: substateWithAncestors,
};

const mockCreateSecondaryResource = {
  ...mockCreateResource,
  data: {
    template: SECONDARY_RESOURCE_CATEGORY_ID,
  },
  response: { headers: { location: `/api/v2/items/${SECONDARY_RESOURCE_DATABASE_ID1}` } },
};

const mockLinkNewPrimer = {
  ...mockPrimerLink,
  url: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}/items_links/${SECONDARY_RESOURCE_DATABASE_ID1}`,
};
const mockLinkExistingPrimer = {
  ...mockPrimerLink,
  url: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}/items_links/${SECONDARY_RESOURCE_DATABASE_ID2}`,
};
const mockLinkToAncestor = {
  ...mockPrimerLink,
  url: `/api/v2/items/${MAIN_RESOURCE_DATABASE_ID}/items_links/${HISTORY_FILE_ANCESTOR_DATABASE_ID}`,
};

const mockUpdateNewPrimer = {
  ...mockPrimerUpdate,
  url: `/api/v2/items/${SECONDARY_RESOURCE_DATABASE_ID1}`,
};

const mockDeleteNewPrimer = {
  ...mockDeleteResource,
  url: `/api/v2/items/${SECONDARY_RESOURCE_DATABASE_ID1}`,
};

describe('test submitSequenceToDatabase', () => {
  it('submitSequenceToDatabase', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockUpdateResource);
    mockedScenarios.push(mockUploadSequenceFile);
    mockedScenarios.push(mockUploadHistoryFile);
    const { primerMappings, databaseId } = await submitSequenceToDatabase(submissionPayload);
    expect(primerMappings).toEqual([]);
    expect(databaseId).toEqual(MAIN_RESOURCE_DATABASE_ID);
  });
  it('submitSequenceToDatabase - create resource network error', async () => {
    mockedScenarios.push(mockNetworkError(mockCreateResource));
    const result = submitSequenceToDatabase(submissionPayload);
    expect(result).rejects.toThrow('Error creating resource: Network error: Cannot connect to eLabFTW');
  });
  it('submitSequenceToDatabase - rename resource network error', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockNetworkError(mockUpdateResource));
    mockedScenarios.push(mockDeleteResource);
    const result = submitSequenceToDatabase(submissionPayload);
    expect(result).rejects.toThrow('Error setting resource title: Network error: Cannot connect to eLabFTW');
  });
  it('submitSequenceToDatabase - submit sequence file network error', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockUpdateResource);
    mockedScenarios.push(mockNetworkError(mockUploadSequenceFile));
    mockedScenarios.push(mockDeleteResource);
    const result = submitSequenceToDatabase(submissionPayload);
    expect(result).rejects.toThrow('Error uploading sequence file: Network error: Cannot connect to eLabFTW');
  });
  it('submitSequenceToDatabase - submit history file network error', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockUpdateResource);
    mockedScenarios.push(mockUploadSequenceFile);
    mockedScenarios.push(mockNetworkError(mockUploadHistoryFile));
    mockedScenarios.push(mockDeleteResource);
    const result = submitSequenceToDatabase(submissionPayload);
    expect(result).rejects.toThrow('Error uploading history file: Network error: Cannot connect to eLabFTW');
  });
  it('submitSequenceToDatabase - submit sequence with primers', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockUpdateResource);
    mockedScenarios.push(mockLinkExistingPrimer);
    mockedScenarios.push(mockCreateSecondaryResource);
    mockedScenarios.push(mockUpdateNewPrimer);
    mockedScenarios.push(mockLinkNewPrimer);
    mockedScenarios.push(mockUploadSequenceFile);
    mockedScenarios.push(mockUploadHistoryFileWithPrimers);
    const { primerMappings, databaseId } = await submitSequenceToDatabase(submissionPayloadWithPrimers);
    expect(primerMappings).toEqual([
      {
        localId: HISTORY_FILE_INTERNAL_PRIMER_ID1,
        databaseId: SECONDARY_RESOURCE_DATABASE_ID1,
      },
    ]);
    expect(databaseId).toEqual(MAIN_RESOURCE_DATABASE_ID);
  });
  it('submitSequenceToDatabase - submit sequence with primers network error when linking primer - deletes both resource and primers', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockUpdateResource);
    mockedScenarios.push(mockLinkExistingPrimer);
    mockedScenarios.push(mockCreateSecondaryResource);
    mockedScenarios.push(mockUpdateNewPrimer);
    mockedScenarios.push(mockNetworkError(mockLinkNewPrimer));
    mockedScenarios.push(mockDeleteNewPrimer);
    mockedScenarios.push(mockDeleteResource);

    const result = submitSequenceToDatabase(submissionPayloadWithPrimers);
    expect(result).rejects.toThrow('Error submitting new primers: Error linking to sequence: Network error: Cannot connect to eLabFTW');
  });
  it('submitSequenceToDatabase - submit sequence with primers network error after linking primer - deletes both resource and primers', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockUpdateResource);
    mockedScenarios.push(mockLinkExistingPrimer);
    mockedScenarios.push(mockCreateSecondaryResource);
    mockedScenarios.push(mockUpdateNewPrimer);
    mockedScenarios.push(mockLinkNewPrimer);
    mockedScenarios.push(mockNetworkError(mockUploadSequenceFile));
    mockedScenarios.push(mockDeleteNewPrimer);
    mockedScenarios.push(mockDeleteResource);

    const result = submitSequenceToDatabase(submissionPayloadWithPrimers);
    expect(result).rejects.toThrow('Error uploading sequence file: Network error: Cannot connect to eLabFTW');
  });
  it('submitSequenceToDatabase - submit sequence with ancestors', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockUpdateResource);
    mockedScenarios.push(mockLinkToAncestor);
    mockedScenarios.push(mockUploadSequenceFile);
    mockedScenarios.push(mockUploadHistoryFileWithAncestors);
    const { primerMappings, databaseId } = await submitSequenceToDatabase(submissionPayloadWithAncestors);
    expect(primerMappings).toEqual([]);
    expect(databaseId).toEqual(MAIN_RESOURCE_DATABASE_ID);
  });
  it('submitSequenceToDatabase - error deleting resource after error', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockUpdateResource);
    mockedScenarios.push(mockNetworkError(mockUploadSequenceFile));
    mockedScenarios.push(mockNetworkError(mockDeleteResource));
    const result = submitSequenceToDatabase(submissionPayload);
    expect(result).rejects.toThrow(`There was an error (Network error: Cannot connect to eLabFTW) while trying to delete the sequence with id ${MAIN_RESOURCE_DATABASE_ID} after an error uploading sequence file.`);
  });
  it('submitSequenceToDatabase - error deleting primer after error', async () => {
    mockedScenarios.push(mockCreateResource);
    mockedScenarios.push(mockUpdateResource);
    mockedScenarios.push(mockLinkExistingPrimer);
    mockedScenarios.push(mockCreateSecondaryResource);
    mockedScenarios.push(mockUpdateNewPrimer);
    mockedScenarios.push(mockLinkNewPrimer);
    mockedScenarios.push(mockNetworkError(mockUploadSequenceFile));
    mockedScenarios.push(mockNetworkError(mockDeleteNewPrimer));

    const result = submitSequenceToDatabase(submissionPayloadWithPrimers);
    expect(result).rejects.toThrow(`There was an error (Network error: Cannot connect to eLabFTW) while trying to delete newly created primers linked to sequence with id ${MAIN_RESOURCE_DATABASE_ID} after an error uploading sequence file.`);
  });
  it('throws error if sequence already has a database_id', () => {
    const submissionPayloadWithDatabaseId = JSON.parse(JSON.stringify(submissionPayload));
    submissionPayloadWithDatabaseId.substate.sources[0].database_id = '123';
    const result = submitSequenceToDatabase(submissionPayloadWithDatabaseId);
    expect(result).rejects.toThrow('Sequence already has a database_id');
  });
});
