/**
 * In-memory storage for the contents of verification (sequencing) files.
 *
 * The raw contents of uploaded sequencing files (e.g. AB1 files) are kept in
 * memory as base64 strings, keyed by `verification-${sequence_id}-${file_name}`
 * (see getVerificationFileName in readNwrite.js).
 *
 * These contents used to be persisted in Web Storage (localStorage in early
 * versions, sessionStorage since the monorepo switch). Both have a quota of
 * roughly 5 MB per origin, so submitting around 10+ AB1 files exceeded the
 * quota, failed with a QuotaExceededError and made the files/alignments
 * silently disappear:
 * https://github.com/OpenCloning/OpenCloning/issues/82
 *
 * The contents are only needed while the tab is open (to display alignments,
 * download files, export zips or realign when new files are submitted). After
 * a page reload the cloning strategy has to be loaded from a file or the
 * database again, and the verification files are loaded along with it, so an
 * in-memory store with the same tab-lifetime semantics but no quota is
 * sufficient.
 */

const fileContents = new Map();

/**
 * Store the base64 content of a verification file.
 * @param {string} key verification file key (see getVerificationFileName)
 * @param {string} base64Content base64-encoded file content
 */
export function setVerificationFileContent(key, base64Content) {
  fileContents.set(key, base64Content);
}

/**
 * Get the base64 content of a verification file, or null if it is not stored.
 * @param {string} key verification file key (see getVerificationFileName)
 */
export function getVerificationFileContent(key) {
  return fileContents.has(key) ? fileContents.get(key) : null;
}

/**
 * Remove the content of a single verification file.
 * @param {string} key verification file key (see getVerificationFileName)
 */
export function removeVerificationFileContent(key) {
  fileContents.delete(key);
}

/**
 * Remove the contents of all verification files associated to a sequence.
 * @param {number} sequenceId id of the sequence
 * @param {string} [fileName] if given, only files whose key starts with
 *   `verification-${sequenceId}-${fileName}` are removed (matches the previous
 *   sessionStorage-based behaviour)
 */
export function removeVerificationFileContents(sequenceId, fileName = null) {
  const prefix = `verification-${sequenceId}-`;
  const query = fileName ? prefix + fileName : prefix;
  for (const key of [...fileContents.keys()]) {
    if (key.startsWith(query)) {
      fileContents.delete(key);
    }
  }
}

/**
 * Remove all stored verification file contents.
 */
export function clearVerificationFileContents() {
  fileContents.clear();
}

// Expose the store when running in Cypress, following the existing pattern of
// exposing window.store in apps/opencloning/src/index.jsx. This lets e2e tests
// assert on the stored file contents.
if (typeof window !== 'undefined' && window.Cypress) {
  window.verificationFileStore = {
    get: getVerificationFileContent,
    set: setVerificationFileContent,
    remove: removeVerificationFileContent,
    removeBySequence: removeVerificationFileContents,
    clear: clearVerificationFileContents,
    size: () => fileContents.size,
  };
}
