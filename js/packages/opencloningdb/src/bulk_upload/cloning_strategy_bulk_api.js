import { openCloningDBHttpClient } from '../common';
import endpoints from '../endpoints';

/**
 * Validate cloning strategy files (OpenCloning JSON or SnapGene .dna) against the database.
 * files: array of File. Resolves to the validation rows, one per file.
 */
export async function validateCloningStrategyFiles(files) {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });
  const { data } = await openCloningDBHttpClient.post(endpoints.sequencesCloningStrategyBulkValidate, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * Submit validated cloning strategies. syncResults as returned by rowsToCloningStrategySyncResults,
 * tags: tag ids to apply to the new sequences and primers. Resolves to the sequence refs of the strategies.
 */
export async function submitCloningStrategies({ syncResults, tags }) {
  const { data } = await openCloningDBHttpClient.post(endpoints.sequencesCloningStrategyBulk, syncResults, {
    params: tags?.length ? { tags } : {},
  });
  return data;
}
