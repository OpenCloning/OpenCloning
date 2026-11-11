import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';

import { addStubToServer, getStub, setupToken, clearToken } from './testUtils.test';
import { setWorkspaceHeader } from './common';
import { file2base64 } from '@opencloning/utils/readNwrite';

vi.mock('./GetPrimerComponent', () => ({ default: () => null }));
vi.mock('./GetSequenceFileAndDatabaseIdComponent', () => ({ default: () => null }));
vi.mock('./LoadHistoryComponent', () => ({ default: () => null }));
vi.mock('./SubmitToDatabaseComponent', () => ({ default: () => null }));
vi.mock('./PrimersNotInDatabaseComponent', () => ({ default: () => null }));
vi.mock('./GetSequencesInBulkComponent', () => ({ default: () => null }));
vi.mock('./SubmitCloningStrategiesInBulkComponent', () => ({ default: () => null }));

import OpenCloningDBInterface from './OpenCloningDBInterface';

const server = setupServer();

beforeAll(() => {
  setupToken();
  setWorkspaceHeader(1);
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  clearToken();
  server.close();
});

describe('submitPrimerToDatabase', () => {
  it('posts the primer and returns the new id', async () => {
    const stub = getStub('post_primer');
    addStubToServer(server, stub);

    const id = await OpenCloningDBInterface.submitPrimerToDatabase({
      submissionData: { title: stub.body.name },
      primer: { sequence: stub.body.sequence },
    });

    expect(id).toBe(stub.response.body.id);
  });
});

describe('getPrimer', () => {
  it('returns primer in interface format', async () => {
    const stub = getStub('get_primer');
    addStubToServer(server, stub);

    const primer = await OpenCloningDBInterface.getPrimer(stub.response.body.id);

    expect(primer).toEqual({
      name: stub.response.body.name,
      'database_id': stub.response.body.id,
      sequence: stub.response.body.sequence,
    });
  });
});

describe('submitSequenceToDatabase', () => {
  it('submits /sequence payload and returns databaseId + filtered mappings', async () => {
    const stub = getStub('post_sequence');
    addStubToServer(server, {
      ...stub,
      body: {
        sources: stub.body.sources,
        primers: stub.body.primers,
        sequences: stub.body.sequences,
      },
    });

    const primerIds = new Set(stub.body.primers.map((primer) => primer.id));
    const sequenceIds = new Set(stub.body.sequences.map((sequence) => sequence.id));
    const expectedPrimerMappings = stub.response.body.mappings.filter(({ localId }) => primerIds.has(localId));
    const expectedSequenceMappings = stub.response.body.mappings.filter(({ localId }) =>
      sequenceIds.has(localId),
    );

    const result = await OpenCloningDBInterface.submitSequenceToDatabase({
      submissionData: { title: 'name' },
      substate: stub.body,
      id: stub.body.sequences[0].id,
    });

    expect(result).toEqual({
      databaseId: stub.response.body.id,
      primerMappings: expectedPrimerMappings,
      sequenceMappings: expectedSequenceMappings,
    });
  });
});

describe('locateSequenceInDatabase', () => {
  it('posts to /sequence/search and returns response data', async () => {
    const stub = getStub('post_sequence_search');
    addStubToServer(server, stub);

    const result = await OpenCloningDBInterface.locateSequenceInDatabase(stub.body);

    expect(result).toEqual(stub.response.body);
  });
});

describe('getSequencingFiles', () => {
  it('gets sequencing files list and supports getFile download', async () => {
    const listStub = getStub('get_sequence_sequencing_files');
    const downloadStub = getStub('download_sequencing_file');
    addStubToServer(server, listStub);
    addStubToServer(server, downloadStub);

    // The sequence id comes from the stub (/db/sequences/<id>/sequencing_files), so it follows the seed data
    const sequenceId = Number(listStub.endpoint.match(/\/db\/sequences\/(\d+)\//)[1]);
    const files = await OpenCloningDBInterface.getSequencingFiles(sequenceId);

    expect(files).toHaveLength(1);
    expect(files[0].id).toBe(listStub.response.body[0].id);
    expect(files[0].name).toBe(listStub.response.body[0].original_name);

    const downloadedFile = await files[0].getFile();
    expect(downloadedFile).toBeInstanceOf(File);
    expect(downloadedFile.name).toBe(listStub.response.body[0].original_name);
    const downloadedText = await file2base64(downloadedFile);
    expect(downloadedText).toBe(downloadStub.response.body);
  });
});

describe('isSubmissionDataValid', () => {
  it('returns true when title is provided', () => {
    expect(OpenCloningDBInterface.isSubmissionDataValid({ title: 'name' })).toBe(true);
  });

  it('returns false when title is missing or empty', () => {
    expect(OpenCloningDBInterface.isSubmissionDataValid({})).toBe(false);
    expect(OpenCloningDBInterface.isSubmissionDataValid({ title: '' })).toBe(false);
  });
});

describe('getSequenceLink', () => {
  it('returns sequence link path', () => {
    expect(OpenCloningDBInterface.getSequenceLink(42)).toBe('sequences/42');
  });
});

describe('getPrimerLink', () => {
  it('returns primer link path', () => {
    expect(OpenCloningDBInterface.getPrimerLink(7)).toBe('primers/7');
  });
});

describe('loadSequenceFromUrlParams', () => {
  it('is currently a no-op', () => {
    expect(OpenCloningDBInterface.loadSequenceFromUrlParams()).toBeUndefined();
  });
});

describe('getSequenceName', () => {
  it('is currently a no-op', () => {
    expect(OpenCloningDBInterface.getSequenceName()).toBeUndefined();
  });
});
