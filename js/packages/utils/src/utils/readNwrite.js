import { elementToSVG, inlineResources } from 'dom-to-svg';
import { ab1ToJson, anyToJson, genbankToJson, jsonToFasta, jsonToGenbank } from '@teselagen/bio-parsers';
import {
  BlobWriter,
  ZipWriter,
  TextReader,
  BlobReader,
  ZipReader,
  configure,
} from '@zip.js/zip.js';
import { tidyUpSequenceData } from '@teselagen/sequence-utils';
import { isEqual } from 'lodash-es';
import {
  getVerificationFileContent,
  setVerificationFileContent,
} from './verificationFileStore';

configure({
  useWebWorkers: false,
});

export function base64ToBlob(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes]);
}

export const downloadBlob = (blob, fileName) => {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const file2base64 = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => {
    const base64String = reader.result.split(',')[1];
    resolve(base64String);
  };
  reader.readAsDataURL(file);
});

export const file2string = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => {
    resolve(reader.result);
  };
  reader.readAsText(file);
});

export const downloadTextFile = (text, fileName, type = 'text/plain') => {
  const blob = new Blob([text], { type });
  downloadBlob(blob, fileName);
};

export async function getZipFileBlob(files) {
  const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
  await Promise.all(files.map((file) => zipWriter.add(file.name, file.reader)));
  return zipWriter.close();
}

export async function readSubmittedTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = (event) => {
      resolve(event.target.result);
    };
    reader.onerror = (error) => {
      reject(new Error('Error reading text file'));
    };
  });
}

export function formatStateForJsonExport(cloningState) {
  const { sequences, sources, description, primers, appInfo } = cloningState;
  const { backendVersion, schemaVersion, frontendVersion } = appInfo;
  return { sequences, sources, description, primers, backend_version: backendVersion, schema_version: schemaVersion, frontend_version: frontendVersion };
}

export const prettyPrintJson = (json) => `${JSON.stringify(json, null, 2)}\n`;

export const downloadStateAsJson = async (cloningState, fileName = 'cloning_strategy.json') => {
  const output = formatStateForJsonExport(cloningState);
  downloadTextFile(prettyPrintJson(output), fileName, 'application/json');
};

export const downloadStateAsZip = async (cloningState, zipFileName = 'cloning_strategy.zip') => {
  const output = formatStateForJsonExport(cloningState);
  output.files = cloningState.files;
  const fileNames = cloningState.files.map((file) => getVerificationFileName(file));
  const files2write = [
    { name: 'cloning_strategy.json', reader: new TextReader(prettyPrintJson(output)) },
    ...fileNames.map((fileName) => {
      const base64Content = getVerificationFileContent(fileName);
      if (!base64Content) {
        const nameOnly = fileName.replace(/verification-\d+-/, '');
        throw new Error(`File ${nameOnly} not found in the verification file store`);
      }
      return { name: fileName, reader: new BlobReader(base64ToBlob(base64Content)) };
    }),
  ];
  const blob = await getZipFileBlob(files2write);
  downloadBlob(blob, zipFileName);
};

/**
 * Download a cloning state as json or zip (with the verification files). The format is 'json' or 'zip',
 * by default the extension of fileName. Rejects for other formats, or if a verification file is missing.
 */
export const downloadState = async (cloningState, fileName, format = fileName.split('.').pop()) => {
  if (format === 'json') {
    return downloadStateAsJson(cloningState, fileName);
  }
  if (format === 'zip') {
    return downloadStateAsZip(cloningState, fileName);
  }
  throw new Error(`Cannot save cloning strategy as ${fileName}, the format must be json or zip`);
};

export const downloadSequence = (fileName, sequenceData) => {
  if (sequenceData === undefined) {
    return;
  }
  if (fileName.endsWith('.gb')) {
    downloadTextFile(jsonToGenbank(sequenceData), fileName);
  } else if (fileName.endsWith('.fasta')) {
    downloadTextFile(jsonToFasta(sequenceData), fileName);
  }
};

export const downloadCloningStrategyAsSvg = async (fileName) => {
  const container = document.querySelector('div.open-cloning');
  // Clone the container to avoid modifying the original
  const containerCopy = container.cloneNode(true);
  containerCopy.id = 'temp-div-svg-print';

  // Make sure the entire element is displayed
  containerCopy.style.overflow = 'visible';
  containerCopy.style.width = 'fit-content';
  containerCopy.style.height = 'fit-content';
  containerCopy.style.position = 'absolute';
  containerCopy.style.left = '-9999px';

  // Remove all MUI icons from the copy before converting to SVG
  const muiIcons = containerCopy.querySelectorAll('.MuiSvgIcon-root');
  muiIcons.forEach((icon) => icon.remove());

  // Remove all "Add" buttons
  const addButtons = containerCopy.querySelectorAll('.hang-from-node');
  addButtons.forEach((button) => button.remove());

  // Remove all "New source box"
  const newSourceBoxes = containerCopy.querySelectorAll('.new_source_box');
  newSourceBoxes.forEach((box) => box.remove());

  container.appendChild(containerCopy);
  const node2print = document.getElementById('temp-div-svg-print');

  const svgDocument = elementToSVG(node2print);
  container.removeChild(node2print);

  await inlineResources(svgDocument.documentElement);
  const svgString = new XMLSerializer().serializeToString(svgDocument);
  downloadTextFile(svgString, fileName);
};

/**
 * Extract the files of a zip whose path (e.g. 'run/A1/A1.fastq') matches filter, as Files named like the
 * file without its folder (e.g. 'A1.fastq'). Directories, hidden files and folders, and anything in
 * __MACOSX/ (e.g. the ._A1.fastq copies that macOS adds) are skipped.
 */
export async function extractFilesFromZip(zipFile, filter) {
  const zipReader = new ZipReader(new BlobReader(zipFile));
  try {
    const entries = (await zipReader.getEntries()).filter((entry) => !entry.directory
      && !entry.filename.split('/').some((part) => part.startsWith('.') || part === '__MACOSX')
      && filter(entry.filename));
    return await Promise.all(entries.map(async (entry) => new File(
      [await entry.getData(new BlobWriter())],
      entry.filename.split('/').pop(),
    )));
  } finally {
    await zipReader.close();
  }
}

/**
 * Read a history file (.json, or .zip with a json and its verification files).
 * Returns { cloningStrategy, verificationFiles }. The shape of the cloning strategy is not checked
 * (see checkCloningStrategyShape), but the verification files of a zip must match the ones in the json.
 */
export async function readHistoryFile(file) {
  const isZipFile = file.name.endsWith('.zip');
  const isJsonFile = file.name.endsWith('.json');

  let cloningStrategyFile;
  let verificationFiles = [];

  if (isZipFile) {
    const zipReader = new ZipReader(new BlobReader(file));
    // Only in the root directory (e.g. Mac sometimes add __MACOSX/.. to the zip)
    const entries = (await zipReader.getEntries()).filter((entry) => !entry.filename.includes('/'));
    const jsonFilesInZip = entries.filter((entry) => entry.filename.endsWith('.json'));

    if (jsonFilesInZip.length !== 1) {
      throw new Error('Zip file must contain exactly one JSON file.');
    }
    cloningStrategyFile = await jsonFilesInZip[0].getData(new BlobWriter());
    verificationFiles = await Promise.all(entries
      .filter((entry) => /verification-\d+-.*/.test(entry.filename))
      .map(async (entry) => {
        const blob = await entry.getData(new BlobWriter());
        return new File([blob], entry.filename, { type: blob.type });
      }));
  } else if (isJsonFile) {
    cloningStrategyFile = file;
  }

  let cloningStrategy;
  try {
    cloningStrategy = JSON.parse(await readSubmittedTextFile(cloningStrategyFile));
  } catch (error) {
    throw new Error('Invalid JSON file.', { cause: error });
  }
  const newCloningStrategy = { ...cloningStrategy };

  // Drop the files if loading only json
  if (isJsonFile) {
    newCloningStrategy.files = [];
  }

  // Check files
  if (isZipFile) {
    if (!newCloningStrategy.files) {
      newCloningStrategy.files = [];
    }
    // Missing files in zip
    const stateFileNames = newCloningStrategy.files.map((f) => getVerificationFileName(f));
    const verificationFileNames = verificationFiles.map((f) => f.name);

    const missingFile = stateFileNames.find((name) => !verificationFileNames.includes(name));
    if (missingFile) {
      throw new Error(`File ${missingFile} not found in zip.`);
    }

    // Excess file in zip
    const excessFile = verificationFileNames.find((name) => !stateFileNames.includes(name));
    if (excessFile) {
      throw new Error(`File ${excessFile} found in zip but not in cloning strategy.`);
    }
  }

  return { cloningStrategy: newCloningStrategy, verificationFiles };
}

/** Throw if the cloning strategy does not have the arrays primers, sequences and sources. */
export function checkCloningStrategyShape(cloningStrategy) {
  if (cloningStrategy === null || typeof cloningStrategy !== 'object'
    || cloningStrategy.primers === undefined || cloningStrategy.sequences === undefined || cloningStrategy.sources === undefined) {
    throw new Error('JSON file should contain at least keys: primers, sequences and sources');
  }
  // They should be arrays
  if (!Array.isArray(cloningStrategy.primers)) {
    throw new Error('primers should be an array');
  }
  if (!Array.isArray(cloningStrategy.sequences)) {
    throw new Error('sequences should be an array');
  }
  if (!Array.isArray(cloningStrategy.sources)) {
    throw new Error('sources should be an array');
  }
}

/** readHistoryFile + checkCloningStrategyShape */
export async function parseHistoryFile(file) {
  const { cloningStrategy, verificationFiles } = await readHistoryFile(file);
  checkCloningStrategyShape(cloningStrategy);
  return { cloningStrategy, verificationFiles };
}

/**
 * Set the app versions on a cloning strategy that does not have them (e.g. one built in the app from a
 * database sequence), so that the backend does not treat it as an old version to migrate.
 * The versions that the cloning strategy already has are kept, so that old files are migrated.
 */
export function fillMissingVersions(cloningStrategy, { backendVersion, schemaVersion, frontendVersion }) {
  return {
    ...cloningStrategy,
    backend_version: cloningStrategy.backend_version ?? backendVersion,
    schema_version: cloningStrategy.schema_version ?? schemaVersion,
    frontend_version: cloningStrategy.frontend_version ?? frontendVersion,
  };
}

/** The data and config to post a file to an endpoint that takes a file (e.g. read_from_file). */
export function fileUploadRequest(file, params = undefined) {
  const requestData = new FormData();
  requestData.append('file', file);
  const config = { headers: { 'content-type': 'multipart/form-data' } };
  if (params !== undefined) {
    config.params = params;
  }
  return { requestData, config };
}

export const loadFilesToVerificationStore = async (files, idShift = 0) => {
  await Promise.all(files.map(async (file) => {
    const fileContent = await file2base64(file);
    const filename = file.name.replace(/verification-(\d+)-/, (match, num) => `verification-${parseInt(num, 10) + idShift}-`);
    setVerificationFileContent(filename, fileContent);
  }));
};

// Deprecated alias kept for backwards compatibility with the published
// @opencloning/utils package. The contents are now kept in an in-memory store
// instead of sessionStorage (see verificationFileStore.js).
export const loadFilesToSessionStorage = loadFilesToVerificationStore;

export function getVerificationFileName({ sequence_id, file_name }) {
  return `verification-${sequence_id}-${file_name}`;
}

export function convertToTeselaJson(sequence) {
  // TODO: This might have been fixed in more recent versions of the library
  // For some reason, as it is it does not read circular or linear properly from certain files
  const { parsedSequence } = genbankToJson(sequence.file_content)[0];

  // TODO: Remove this eventually?
  // if (sequence.file_content.split('\n')[0].includes('linear')) {
  //   parsedSequence.circular = false;
  // }

  parsedSequence.id = sequence.id;
  return tidyUpSequenceData(parsedSequence);
}

export async function getTeselaJsonFromBase64(ab1Base64, fileName = null) {
  try {
    const blob = base64ToBlob(ab1Base64);
    const results = await (fileName.endsWith('.ab1') ? ab1ToJson(blob) : anyToJson(blob, { fileName }));
    // The parsers don't throw on invalid files, they return [{ success: false }]
    const parsedSequence = results?.[0]?.success ? results[0].parsedSequence : null;
    if (!parsedSequence) {
      throw new Error('not a valid sequence file');
    }
    if (!parsedSequence.sequence) {
      throw new Error('the file contains no sequence');
    }
    return parsedSequence;
  } catch (error) {
    const fileNameError = fileName || 'file';
    throw new Error(`Error parsing ${fileNameError}: ${error.message}`, { cause: error });
  }
}

/**
 * Read a sequencing file (ab1, fasta, genbank, fastq...) and parse it.
 * Returns the base64 content (to store it) and the parsed teselaJson (e.g. teselaJson.sequence is the trace).
 */
export async function readSequencingFile(file) {
  const base64str = await file2base64(file);
  const teselaJson = await getTeselaJsonFromBase64(base64str, file.name);
  return { base64str, teselaJson };
}

export function formatTemplate(data, url) {
  const newData = { ...data };
  const segments = url.split('/');
  const kitUrl = segments[segments.length - 3];
  const rootGithubUrl = 'https://assets.opencloning.org/OpenCloning-submission/submissions';
  newData.sources = newData.sources.map((s) => ((!s.image || s.image[0] === null) ? s : {
    ...s, image: [`${rootGithubUrl}/${kitUrl}/${s.image[0]}`, s.image[1]],
  }));
  return newData;
}

export function updateVerificationFileNames(verificationFiles, originalFiles, validatedFiles) {
  if (isEqual(originalFiles.map((f) => getVerificationFileName(f)), validatedFiles.map((f) => getVerificationFileName(f)))) {
    return [...verificationFiles];
  }
  return verificationFiles.map((file) => {
    const preValidationName = file.name;
    const newFileIndex = originalFiles.findIndex((f) => getVerificationFileName(f) === preValidationName);

    if (newFileIndex !== -1) {
      const postValidationName = getVerificationFileName(validatedFiles[newFileIndex]);
      if (preValidationName !== postValidationName) {
        // Create a new File object with the updated name
        return new File([file], postValidationName, { type: file.type });
      }
    }

    // Return the original file if no update is needed
    return file;
  });
}

export function jsonToDelimitedFile(json, delimiter = '\t') {
  const headers = Object.keys(json[0]);
  const rows = json.map((obj) =>
    headers
      .map((header) =>
        String(obj[header]).replaceAll(/[\r\n]+/g, ' ').replaceAll(delimiter, ' ')
      )
      .join(delimiter)
  );
  return [headers.join(delimiter), ...rows].join('\n');
}
