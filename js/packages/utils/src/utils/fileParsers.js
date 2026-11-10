import { stringIsNotDNA } from '@opencloning/store/cloning_utils';
import { readSubmittedTextFile } from './readNwrite';

export async function delimitedFileToJson(fileUploaded, requiredHeaders = [], ignoreHeaderCase = false) {

  const fileContent = await readSubmittedTextFile(fileUploaded);
  const allLines = fileContent.split(/\r\n|\r|\n/);

  let delimiter = null;
  if (fileUploaded.name.endsWith('.csv')) {
    delimiter = new RegExp('[,;]');
  } else if (fileUploaded.name.endsWith('.tsv')) {
    delimiter = /\t/;
  } else {
    throw new Error('File must be a .csv or .tsv file');
  }
  // Remove empty lines
  const lines = allLines.filter(line => line.trim() !== '');

  // If any line contains , and ;, throw an error
  if (fileUploaded.name.endsWith('.csv') && fileContent.includes(',') && fileContent.includes(';')) {
    throw new Error('File must contain only one delimiter, either comma or semicolon');
  }

  if (lines.length === 0) {
    throw new Error('File is empty');
  }

  let headers = lines[0].split(delimiter).map((header) => header.trim());
  if (ignoreHeaderCase) {
    headers = headers.map((header) => header.toLowerCase());
  }

  const missingHeaders = requiredHeaders.filter(
    (header) => !headers.includes(header),
  );

  if (missingHeaders.length > 0) {
    throw new Error(`Headers missing: ${missingHeaders.join(', ')}`);
  }

  // All lines should have the same number of tabs
  if (lines.some((line) => line.split(delimiter).length !== headers.length)) {
    throw new Error('All lines should have the same number of columns');
  }
  return lines.slice(1).map((line) => {
    const values = line.split(delimiter);
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = values[i];
    });
    return obj;
  });
};

export const primersFromTextFile = async (fileUploaded, existingNames) => {
  const primers = await delimitedFileToJson(fileUploaded, ['name', 'sequence'], true);
  return primers.map((primer) => {
    if (existingNames.includes(primer.name)) {
      return { ...primer, error: 'existing' };
    } else if (stringIsNotDNA(primer.sequence)) {
      return { ...primer, error: 'invalid' };
    }
    return { ...primer, error: '' };
  });
};
