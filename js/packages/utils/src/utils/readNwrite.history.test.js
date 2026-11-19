import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkCloningStrategyShape,
  downloadState,
  fileUploadRequest,
  fillMissingVersions,
  parseHistoryFile,
  readHistoryFile,
} from './readNwrite';

const strategy = { primers: [], sequences: [], sources: [] };

const appInfo = { backendVersion: '1.0.0', schemaVersion: '0.5.0', frontendVersion: '2.0.0' };

// Zip files are not tested here: jsdom's Blob cannot hold the bytes that zip.js writes. They are
// covered by cypress/e2e/group-4/upload_history_file.cy.js and source_submit_file.cy.js.

describe('readHistoryFile', () => {
  it('reads a json file and drops its verification files', async () => {
    const file = new File([JSON.stringify({ ...strategy, files: [{ sequence_id: 1, file_name: 'a.ab1' }] })], 'history.json');
    const { cloningStrategy, verificationFiles } = await readHistoryFile(file);
    expect(cloningStrategy).toEqual({ ...strategy, files: [] });
    expect(verificationFiles).toEqual([]);
  });

  it('does not check the shape of the cloning strategy', async () => {
    const { cloningStrategy } = await readHistoryFile(new File(['{"a": 1}'], 'history.json'));
    expect(cloningStrategy).toEqual({ a: 1, files: [] });
  });

  it('throws for invalid json', async () => {
    await expect(readHistoryFile(new File(['not json'], 'history.json'))).rejects.toThrow('Invalid JSON file.');
  });
});

describe('checkCloningStrategyShape', () => {
  it('accepts a cloning strategy with primers, sequences and sources', () => {
    expect(() => checkCloningStrategyShape(strategy)).not.toThrow();
  });

  it.each([null, 'a string', 1, {}, { primers: [], sequences: [] }])('rejects %j', (value) => {
    expect(() => checkCloningStrategyShape(value)).toThrow('JSON file should contain at least keys: primers, sequences and sources');
  });

  it.each(['primers', 'sequences', 'sources'])('rejects %s that is not an array', (key) => {
    expect(() => checkCloningStrategyShape({ ...strategy, [key]: {} })).toThrow(`${key} should be an array`);
  });
});

describe('parseHistoryFile', () => {
  it('reads the file and checks its shape', async () => {
    await expect(parseHistoryFile(new File(['{"a": 1}'], 'history.json'))).rejects.toThrow('JSON file should contain at least keys');
    const { cloningStrategy } = await parseHistoryFile(new File([JSON.stringify(strategy)], 'history.json'));
    expect(cloningStrategy).toEqual({ ...strategy, files: [] });
  });
});

describe('fillMissingVersions', () => {
  it('sets the app versions if the cloning strategy has none', () => {
    expect(fillMissingVersions(strategy, appInfo)).toEqual({
      ...strategy, backend_version: '1.0.0', schema_version: '0.5.0', frontend_version: '2.0.0',
    });
  });

  it('replaces null versions', () => {
    const result = fillMissingVersions({ ...strategy, schema_version: null }, appInfo);
    expect(result.schema_version).toBe('0.5.0');
  });

  it('keeps the versions of the cloning strategy, so that old ones are migrated', () => {
    const old = { ...strategy, backend_version: '0.1.0', schema_version: '0.2.9', frontend_version: '0.1.0' };
    expect(fillMissingVersions(old, appInfo)).toEqual(old);
  });

  it('does not modify the input', () => {
    const input = { ...strategy };
    fillMissingVersions(input, appInfo);
    expect(input).toEqual(strategy);
  });
});

describe('fileUploadRequest', () => {
  it('puts the file in the form data, without params', () => {
    const file = new File(['ACGT'], 'a.fasta');
    const { requestData, config } = fileUploadRequest(file);
    expect(requestData.get('file').name).toBe('a.fasta');
    expect(config).toEqual({ headers: { 'content-type': 'multipart/form-data' } });
  });

  it('adds the params', () => {
    const { config } = fileUploadRequest(new File(['ACGT'], 'a.fasta'), { circularize: true });
    expect(config.params).toEqual({ circularize: true });
  });
});

describe('downloadState', () => {
  const cloningState = { ...strategy, description: '', files: [], appInfo };
  let downloadedNames;

  beforeEach(() => {
    downloadedNames = [];
    URL.createObjectURL = vi.fn(() => 'blob:url');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
      downloadedNames.push(this.download);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads json or zip depending on the extension', async () => {
    await downloadState(cloningState, 'a.json');
    await downloadState(cloningState, 'b.zip');
    expect(downloadedNames).toEqual(['a.json', 'b.zip']);
  });

  it('uses the format if given', async () => {
    await downloadState(cloningState, 'history', 'json');
    expect(downloadedNames).toEqual(['history']);
  });

  it('rejects other formats', async () => {
    await expect(downloadState(cloningState, 'a.gb')).rejects.toThrow('the format must be json or zip');
    expect(downloadedNames).toEqual([]);
  });

  it('rejects a zip if a verification file is missing', async () => {
    const state = { ...cloningState, files: [{ sequence_id: 1, file_name: 'missing.ab1' }] };
    await expect(downloadState(state, 'a.zip')).rejects.toThrow('File missing.ab1 not found in the verification file store');
    expect(downloadedNames).toEqual([]);
  });
});
