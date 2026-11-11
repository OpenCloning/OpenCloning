import {
  setVerificationFileContent,
  getVerificationFileContent,
  removeVerificationFileContent,
  removeVerificationFileContents,
  clearVerificationFileContents,
} from './verificationFileStore';

describe('verificationFileStore (in-memory verification file storage)', () => {
  beforeEach(() => {
    clearVerificationFileContents();
  });

  it('stores and retrieves a file content', () => {
    setVerificationFileContent('verification-1-file.ab1', 'aGVsbG8=');
    expect(getVerificationFileContent('verification-1-file.ab1')).toBe('aGVsbG8=');
  });

  it('returns null for a missing key', () => {
    expect(getVerificationFileContent('verification-1-missing.ab1')).toBeNull();
  });

  it('overwrites an existing key', () => {
    setVerificationFileContent('verification-1-file.ab1', 'first');
    setVerificationFileContent('verification-1-file.ab1', 'second');
    expect(getVerificationFileContent('verification-1-file.ab1')).toBe('second');
  });

  it('keeps different sequences with the same file name separate', () => {
    setVerificationFileContent('verification-1-file.ab1', 'seq1');
    setVerificationFileContent('verification-2-file.ab1', 'seq2');
    expect(getVerificationFileContent('verification-1-file.ab1')).toBe('seq1');
    expect(getVerificationFileContent('verification-2-file.ab1')).toBe('seq2');
  });

  it('removes a single file content', () => {
    setVerificationFileContent('verification-1-file.ab1', 'a');
    setVerificationFileContent('verification-1-other.ab1', 'b');
    removeVerificationFileContent('verification-1-file.ab1');
    expect(getVerificationFileContent('verification-1-file.ab1')).toBeNull();
    expect(getVerificationFileContent('verification-1-other.ab1')).toBe('b');
  });

  it('removes all file contents for a sequence', () => {
    setVerificationFileContent('verification-1-file.ab1', 'a');
    setVerificationFileContent('verification-1-other.ab1', 'b');
    // We use 10 because of the startswith deletion logic in removeVerificationFileContents
    setVerificationFileContent('verification-10-file.ab1', 'c');
    removeVerificationFileContents(1);
    expect(getVerificationFileContent('verification-1-file.ab1')).toBeNull();
    expect(getVerificationFileContent('verification-1-other.ab1')).toBeNull();
    expect(getVerificationFileContent('verification-10-file.ab1')).toBe('c');
  });

  it('removes a specific file within a sequence when fileName is given', () => {
    setVerificationFileContent('verification-1-file.ab1', 'a');
    setVerificationFileContent('verification-1-file2.ab1', 'b');
    removeVerificationFileContents(1, 'file.ab1');
    expect(getVerificationFileContent('verification-1-file.ab1')).toBeNull();
    expect(getVerificationFileContent('verification-1-file2.ab1')).toBe('b');
  });

  it('clears all contents', () => {
    setVerificationFileContent('verification-1-file.ab1', 'a');
    setVerificationFileContent('verification-2-file.ab1', 'b');
    clearVerificationFileContents();
    expect(getVerificationFileContent('verification-1-file.ab1')).toBeNull();
    expect(getVerificationFileContent('verification-2-file.ab1')).toBeNull();
  });

  // Regression test for https://github.com/OpenCloning/OpenCloning/issues/82
  // Storing ~12 AB1 files of ~350 KB each (3.9 MiB total, ~5.2 MB in base64)
  // exceeded the ~5 MB Web Storage quota. The in-memory store has no quota, so
  // all files must be stored and retrievable.
  it('stores many large files without any quota limit (issue #82)', () => {
    const nFiles = 12;
    const totalBytes = 3.9 * 1024 * 1024; // 3.9 MiB as reported in the issue
    const perFile = Math.floor(totalBytes / nFiles);
    const base64Length = Math.ceil((perFile * 4) / 3);
    const content = 'A'.repeat(base64Length);

    const keys = [];
    for (let i = 1; i <= nFiles; i++) {
      const key = `verification-17-KKF080_${70250800 + i}_70250801.ab1`;
      keys.push(key);
      setVerificationFileContent(key, content);
    }
    // Total stored in base64 is ~5.2 MB, well above the 5 MB Web Storage quota
    expect(keys.reduce((sum, k) => sum + getVerificationFileContent(k).length, 0))
      .toBeGreaterThan(5 * 1024 * 1024);
    keys.forEach((key) => {
      expect(getVerificationFileContent(key)).toBe(content);
    });

    // And a sequence-level cleanup still empties the store for that sequence
    removeVerificationFileContents(17);
    keys.forEach((key) => {
      expect(getVerificationFileContent(key)).toBeNull();
    });
  });
});
